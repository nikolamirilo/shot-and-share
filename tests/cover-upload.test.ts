import { beforeEach, describe, expect, it, vi } from "vitest";

import { TIERS } from "@/lib/tiers";
import { createStore } from "./stubs/supabase";

/**
 * The host's own cover image, end to end with the database and the bucket
 * mocked.
 *
 * It is the guest handshake with the token swapped for a session, so the things
 * worth asserting are the ones that differ: it takes photographs only, it is
 * behind the same paywall as the panel it is reached from, and the row it
 * finally writes carries `source = 'cover'` - which is the whole reason the
 * host's decoration does not turn up in their guests' gallery.
 */

const store = createStore();

const OWNER = "00000000-1111-2222-3333-444444444444";

let events = 0;
let event = freshEvent();

/**
 * A new event id per test. The upload limiter is keyed on the event, and a file
 * that reused one id would start getting 429s partway down rather than testing
 * what it says it tests.
 */
function freshEvent() {
  events += 1;
  return {
    id: `11111111-2222-3333-4444-${String(events).padStart(12, "0")}`,
    owner_id: OWNER,
    tier: TIERS.plus.id,
    status: "active",
    storage_quota_bytes: 2 * 1024 ** 3,
    storage_used_bytes: 0,
  };
}

vi.mock("@/lib/host", () => ({
  requireOwnedEvent: vi.fn(async () => event),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    presignUpload: vi.fn(async ({ key }: { key: string }) => {
      return {
        url: "https://bucket.example/",
        fields: { key },
        fileField: "file",
      };
    }),
    publicUrl: (key: string) => `https://cdn.example/${key}`,
    presignDownload: vi.fn(async ({ key }: { key: string }) =>
      `https://signed.example/${key}`,
    ),
  },
}));

const { POST: presign } = await import(
  "@/app/api/events/[id]/cover/presign/route"
);
const { POST: confirm } = await import(
  "@/app/api/events/[id]/cover/confirm/route"
);

function presignRequest(file: unknown) {
  return presign(
    new Request("http://localhost/api/events/x/cover/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    }),
    { params: Promise.resolve({ id: event.id }) },
  );
}

function confirmRequest(body: unknown) {
  return confirm(
    new Request("http://localhost/api/events/x/cover/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: event.id }) },
  );
}

/** What the browser sends for an image it managed to compress. */
const compressedImage = {
  size: 4_000_000,
  type: "image/jpeg",
  compressed: { size: 300_000, format: "webp", width: 2560, height: 1707 },
  sourceWidth: 6000,
  sourceHeight: 4000,
  needsServer: false,
};

beforeEach(() => {
  store.reset();
  event = freshEvent();
});

describe("presigning a cover image", () => {
  it("reserves the compressed size and signs into the event folder", async () => {
    const response = await presignRequest(compressedImage);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(store.reserved()).toBe(300_000);

    const key = body.upload.media.fields.key;
    expect(key).toMatch(
      new RegExp(`^${OWNER}/${event.id}/full/[0-9a-f-]+\\.webp$`),
    );
    // The encoded copy is what goes up, never the six-megapixel original.
    expect(body.upload.source).toBe("compressed");
  });

  it("writes a reservation with no fingerprint on it", async () => {
    await presignRequest(compressedImage);

    const [reservation] = store.rows("upload_reservations");
    expect(reservation.event_id).toBe(event.id);
    expect(reservation.owner_id).toBe(OWNER);
    expect(reservation.poster_key).toBeNull();
    // The null is what stops the guest confirm from ever accepting this
    // reservation, and what the cover confirm checks for.
    expect((reservation.media as Record<string, unknown>).uploader_fingerprint)
      .toBeNull();
    expect((reservation.media as Record<string, unknown>).processing).toBe(
      "done",
    );
  });

  it("refuses a video", async () => {
    const response = await presignRequest({
      size: 8_000_000,
      type: "video/mp4",
      needsServer: true,
    });

    expect(response.status).toBe(400);
    expect(store.reserved()).toBe(0);
    expect(store.rows("upload_reservations")).toHaveLength(0);
  });

  it("refuses an image larger than the tier allows", async () => {
    const response = await presignRequest({
      ...compressedImage,
      size: 500 * 1024 * 1024,
    });

    expect(response.status).toBe(400);
    expect(store.reserved()).toBe(0);
  });

  it("refuses on the free plan, and reserves nothing", async () => {
    event = { ...event, tier: TIERS.free.id };
    const response = await presignRequest(compressedImage);

    expect(response.status).toBe(403);
    expect((await response.json()).error.upgrade).toBe(true);
    expect(store.reserved()).toBe(0);
    expect(store.rows("upload_reservations")).toHaveLength(0);
  });

  it("refuses when the event is full", async () => {
    store.setReserveSucceeds(false);
    const response = await presignRequest(compressedImage);

    expect(response.status).toBe(413);
    expect(store.rows("upload_reservations")).toHaveLength(0);
  });
});

describe("confirming a cover image", () => {
  async function reserve() {
    const body = await (await presignRequest(compressedImage)).json();
    return body.upload.mediaId as string;
  }

  it("writes a cover row and tears up the reservation", async () => {
    const mediaId = await reserve();
    const response = await confirmRequest({ mediaId, mediaUploaded: true });
    const body = await response.json();

    expect(body.confirmed).toBe(true);
    expect(body.item.id).toBe(mediaId);

    const [row] = store.rows("media");
    // The one column that keeps this out of the gallery, the slideshow, the
    // ZIP and the photo count.
    expect(row.source).toBe("cover");
    expect(row.kind).toBe("photo");
    expect(row.status).toBe("ready");
    expect(row.uploader_fingerprint).toBeNull();
    expect(row.poster_key).toBeNull();

    expect(store.rows("upload_reservations")).toHaveLength(0);
    expect(store.released()).toBe(0);
  });

  it("refuses to turn a guest's reservation into a cover", async () => {
    const mediaId = await reserve();
    // A guest's reservation carries a fingerprint. Without the check the host
    // could name one here and have the guest's photograph written in as their
    // cover - which would then vanish from the gallery it was uploaded to.
    const [reservation] = store.rows("upload_reservations");
    (reservation.media as Record<string, unknown>).uploader_fingerprint =
      "f".repeat(16);

    const response = await confirmRequest({ mediaId, mediaUploaded: true });

    expect((await response.json()).confirmed).toBe(false);
    expect(store.rows("media")).toHaveLength(0);
    // The reservation is left alone: it is not this endpoint's to reclaim.
    expect(store.rows("upload_reservations")).toHaveLength(1);
  });
});
