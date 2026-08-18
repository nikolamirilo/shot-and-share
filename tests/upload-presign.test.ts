import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { TIERS } from "@/lib/tiers";

/**
 * The presign endpoint, end to end with the database and the bucket mocked.
 *
 * It is the one route where a mistake is invisible until a guest is standing in
 * a venue: it decides what gets stored, reserves the quota, writes the
 * reservation and signs the URLs, and every one of those steps can fail in a
 * way the browser reports as "could not start the upload".
 *
 * What it must never do any more is touch `media`. A media row means a photo
 * that exists; until the bytes are in the bucket there is only a promise of
 * space, and the point of migration 0010 is that the two are different things.
 */

const store = createStore();
let signThrows = false;

const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: "00000000-1111-2222-3333-444444444444",
  tier: TIERS.free.id,
  status: "active",
  storage_quota_bytes: 2 * 1024 ** 3,
  storage_used_bytes: 0,
};

vi.mock("@/lib/events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/events")>(
    "@/lib/events",
  );
  return {
    ...actual,
    requireGuestEvent: vi.fn(async () => ({ event: EVENT, tokenId: "t" })),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

vi.mock("@/lib/storage", () => ({
  storage: {
    presignUpload: vi.fn(async ({ key }: { key: string }) => {
      if (signThrows) throw new Error("bucket credentials expired");
      return {
        url: "https://bucket.example/",
        fields: { key },
        fileField: "file",
      };
    }),
  },
}));

const { POST } = await import("@/app/api/upload/presign/route");

let requests = 0;

function request(file: unknown) {
  // A fresh token per call: the rate limiter is per link and this file makes
  // more than a handful of requests.
  requests += 1;
  return new Request("http://localhost/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: `${requests}`.padStart(32, "a"),
      fingerprint: "f".repeat(16),
      file,
    }),
  });
}

/**
 * What the browser sends for a photo it managed to encode: the full-size copy
 * at every pixel the camera captured, and a small one for the grid.
 */
const compressedPhoto = {
  size: 4_000_000,
  type: "image/jpeg",
  compressed: { size: 1_950_000, format: "jpeg", width: 4032, height: 3024 },
  thumb: { size: 25_000, format: "webp", width: 640, height: 480 },
  sourceWidth: 4032,
  sourceHeight: 3024,
  needsServer: false,
};

/** A HEIC outside Safari: the browser decoded nothing, so the worker owes both. */
const undecodablePhoto = {
  size: 2_000_000,
  type: "image/heic",
  compressed: null,
  thumb: null,
  sourceWidth: null,
  sourceHeight: null,
  needsServer: true,
};

const video = {
  size: 8_000_000,
  type: "video/quicktime",
  poster: { size: 40_000, format: "webp", width: 720, height: 405 },
  sourceWidth: 1920,
  sourceHeight: 1080,
  durationSeconds: 12,
  needsServer: true,
};

const reservations = () => store.rows("upload_reservations");

beforeEach(() => {
  store.reset();
  signThrows = false;
  EVENT.tier = TIERS.free.id;
});

describe("presigning an upload", () => {
  it("signs the full copy and its thumbnail, and nothing else", async () => {
    const res = await POST(request(compressedPhoto));
    const body = await res.json();

    expect(res.status).toBe(200);

    const { upload } = body;
    // Two objects for a photo, and the browser is told to send the encoded
    // blob rather than the file off the disk.
    expect(upload.source).toBe("compressed");
    expect(upload.media).toBeTruthy();
    expect(upload.thumb).toBeTruthy();
    expect(upload.poster).toBeNull();
    expect(Object.keys(upload).sort()).toEqual(
      ["mediaId", "media", "thumb", "poster", "source"].sort(),
    );
  });

  it("puts each copy in its own folder and charges for both", async () => {
    const res = await POST(request(compressedPhoto));
    const { upload } = await res.json();

    expect(upload.media.fields.key).toMatch(/\/full\/[^/]+\.jpg$/);
    expect(upload.thumb.fields.key).toMatch(/\/thumb\/[^/]+\.webp$/);

    // Both objects are promised, so both are charged for before a URL is
    // issued. Charging afterwards means the bytes are already billable.
    const reservation = reservations().at(-1)!;
    expect(Number(reservation.size_bytes)).toBe(1_950_000);
    expect(Number(reservation.thumb_size_bytes)).toBe(25_000);
    expect(reservation.thumb_key).toBe(upload.thumb.fields.key);
  });

  it("signs no thumbnail for a photo the browser could not decode", async () => {
    // A HEIC outside Safari. Nothing may be signed for a thumbnail that will
    // never be posted - the worker cuts it instead.
    const res = await POST(request(undecodablePhoto));
    const { upload } = await res.json();

    expect(res.status).toBe(200);
    expect(upload.source).toBe("file");
    expect(upload.thumb).toBeNull();
    expect(reservations().at(-1)!.thumb_key).toBeNull();
  });

  it("signs no thumbnail for a video, whose poster already is one", async () => {
    EVENT.tier = TIERS.pro.id;
    const res = await POST(request(video));
    const { upload } = await res.json();

    expect(upload.thumb).toBeNull();
    expect(upload.poster).toBeTruthy();
  });

  it("keys that object inside the owner's event folder, at the root", async () => {
    const res = await POST(request(compressedPhoto));
    const { upload } = await res.json();

    expect(upload.media.fields.key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/full/${upload.mediaId}.jpg`,
    );
    expect(upload.thumb.fields.key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/thumb/${upload.mediaId}.webp`,
    );
  });

  it("writes no media row at all - only a reservation", async () => {
    await POST(request(compressedPhoto));

    expect(store.rows("media")).toHaveLength(0);
    expect(reservations()).toHaveLength(1);
  });

  it("writes a reservation the CHECK constraint in 0010 will accept", async () => {
    await POST(request(compressedPhoto));
    const row = reservations()[0];

    // The constraint is `media_key like owner_id || '/' || event_id || '/%'`.
    expect(
      String(row.media_key).startsWith(`${EVENT.owner_id}/${EVENT.id}/`),
    ).toBe(true);
    expect(row.poster_key).toBeNull();
    expect(row.owner_id).toBe(EVENT.owner_id);
  });

  it("charges the encoded size, not what came off the phone", async () => {
    await POST(request(compressedPhoto));
    const row = reservations()[0];

    expect(row.size_bytes).toBe(1_950_000);
    // The thumbnail is charged for too, or a host is billed for one object and
    // stores two.
    expect(store.reserved()).toBe(1_975_000);

    const media = row.media as Record<string, unknown>;
    expect(media.media_format).toBe("jpeg");
    expect(media.mime_type).toBe("image/jpeg");
    expect(media.thumb_format).toBe("webp");
    // Nothing left for the worker: the objects in the bucket are already right.
    expect(media.processing).toBe("done");
  });

  it("takes a photo the browser could not decode and queues the worker", async () => {
    const res = await POST(
      request({
        size: 3_000_000,
        type: "image/heic",
        compressed: null,
        sourceWidth: null,
        sourceHeight: null,
        needsServer: true,
      }),
    );
    const { upload } = await res.json();
    const row = reservations()[0];
    const media = row.media as Record<string, unknown>;

    // It goes up as it came off the phone; the worker replaces it with a JPEG.
    expect(upload.source).toBe("file");
    expect(String(row.media_key).endsWith(".heic")).toBe(true);
    expect(row.size_bytes).toBe(3_000_000);
    expect(media.media_format).toBe("heic");
    expect(media.processing).toBe("pending");
  });

  /**
   * The bug this exists to kill. A file picker is not obliged to report a MIME
   * type and frequently does not - HEIC on Android and Windows has no mapping
   * at all, and a file dragged out of a file manager arrives with an empty type
   * on every platform. The route used to refuse the request outright, so a
   * guest whose browser had already decoded the photograph and handed over a
   * finished WebP was told their file type was not supported.
   */
  it("takes a photo whose type the picker never reported", async () => {
    const res = await POST(request({ ...compressedPhoto, type: "" }));
    const { upload } = await res.json();

    expect(res.status).toBe(200);
    // Stored as what the browser actually produced, which is all that is going
    // up: the source type was never going to describe the stored object.
    expect(upload.source).toBe("compressed");
    expect(upload.media.fields.key).toMatch(/\.jpg$/);
    expect(reservations()[0].size_bytes).toBe(1_950_000);
  });

  it("still refuses a type it does not know and cannot see a photo behind", async () => {
    const res = await POST(
      request({
        size: 3_000_000,
        type: "application/zip",
        compressed: null,
        needsServer: true,
      }),
    );

    expect(res.status).toBe(400);
    expect(store.reserved()).toBe(0);
    expect(reservations()).toHaveLength(0);
  });

  /**
   * An untyped file the browser could not decode either. There is nothing to
   * infer from, so it is refused - but the refusal has to survive the change
   * above rather than falling through it.
   */
  it("refuses an untyped file the browser could not decode", async () => {
    const res = await POST(
      request({
        size: 3_000_000,
        type: "",
        compressed: null,
        needsServer: true,
      }),
    );

    expect(res.status).toBe(400);
    expect(store.reserved()).toBe(0);
  });

  it("refuses video on a tier without it, before reserving anything", async () => {
    const res = await POST(request(video));

    expect(res.status).toBe(403);
    expect(reservations()).toHaveLength(0);
    expect(store.reserved()).toBe(0);
  });

  it("signs a poster beside a video on a tier that allows it", async () => {
    EVENT.tier = TIERS.plus.id;
    const res = await POST(request(video));
    const { upload } = await res.json();
    const row = reservations()[0];

    expect(res.status).toBe(200);
    expect(upload.source).toBe("file");
    expect(upload.poster).toBeTruthy();

    // The clip goes in full/ like a photo; its poster stays in the event
    // folder, named after the clip rather than filed under it.
    expect(row.media_key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/full/${upload.mediaId}.mov`,
    );
    expect(row.poster_key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/${upload.mediaId}-poster.webp`,
    );
    expect(row.thumb_key).toBeNull();
    expect(row.poster_size_bytes).toBe(40_000);
    // Both objects are charged for up front, or a guest could send a poster
    // into an event with no room for it.
    expect(store.reserved()).toBe(8_040_000);
  });

  it("hands the quota back when the reservation insert fails", async () => {
    store.failInsert("upload_reservations", {
      message: "relation upload_reservations does not exist",
    });
    const res = await POST(request(compressedPhoto));

    // The guest sees a generic failure; the operator sees the cause in the log.
    expect(res.status).toBe(500);
    expect(store.released()).toBe(1_975_000);
  });

  /**
   * The regression this route was carrying: the rollback existed only on the
   * insert path, so a bucket that had lost its credentials ate a host's quota
   * one upload at a time, and left a row behind for each one.
   */
  it("hands the quota back when signing fails, and keeps no reservation", async () => {
    signThrows = true;
    const res = await POST(request(compressedPhoto));

    expect(res.status).toBe(500);
    expect(reservations()).toHaveLength(0);
    expect(store.released()).toBe(1_975_000);
  });

  it("refuses when the event is full, without writing anything", async () => {
    store.setReserveSucceeds(false);
    const res = await POST(request(compressedPhoto));
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.error.upgrade).toBe(true);
    expect(reservations()).toHaveLength(0);
  });
});
