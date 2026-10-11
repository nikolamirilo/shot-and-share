import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { TIERS } from "@/lib/tiers";

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

vi.mock("@/lib/guards/guest", async () => {
  const actual = await vi.importActual<typeof import("@/lib/guards/guest")>(
    "@/lib/guards/guest",
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
  // A fresh token per call: the rate limiter is per link.
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

const compressedPhoto = {
  size: 4_000_000,
  type: "image/jpeg",
  compressed: { size: 1_950_000, format: "jpeg", width: 4032, height: 3024 },
  thumb: { size: 25_000, format: "webp", width: 640, height: 480 },
  sourceWidth: 4032,
  sourceHeight: 3024,
  needsServer: false,
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
  it("puts each copy in its own folder and charges for both", async () => {
    const res = await POST(request(compressedPhoto));
    const { upload } = await res.json();

    expect(upload.media.fields.key).toMatch(/\/full\/[^/]+\.jpg$/);
    expect(upload.thumb.fields.key).toMatch(/\/thumb\/[^/]+\.webp$/);

    const reservation = reservations().at(-1)!;
    expect(Number(reservation.size_bytes)).toBe(1_950_000);
    expect(Number(reservation.thumb_size_bytes)).toBe(25_000);
    expect(reservation.thumb_key).toBe(upload.thumb.fields.key);
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
    expect(store.reserved()).toBe(1_975_000);

    const media = row.media as Record<string, unknown>;
    expect(media.media_format).toBe("jpeg");
    expect(media.mime_type).toBe("image/jpeg");
    expect(media.thumb_format).toBe("webp");
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

    expect(upload.source).toBe("file");
    expect(String(row.media_key).endsWith(".heic")).toBe(true);
    expect(row.size_bytes).toBe(3_000_000);
    expect(media.media_format).toBe("heic");
    expect(media.processing).toBe("pending");
  });

  it("takes a photo whose type the picker never reported", async () => {
    const res = await POST(request({ ...compressedPhoto, type: "" }));
    const { upload } = await res.json();

    expect(res.status).toBe(200);
    expect(upload.source).toBe("compressed");
    expect(upload.media.fields.key).toMatch(/\.jpg$/);
    expect(reservations()[0].size_bytes).toBe(1_950_000);
  });

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

    expect(row.media_key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/videos/full/${upload.mediaId}.mov`,
    );
    expect(row.poster_key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/videos/poster/${upload.mediaId}.webp`,
    );
    expect(row.thumb_key).toBeNull();
    expect(row.poster_size_bytes).toBe(40_000);
    expect(store.reserved()).toBe(8_040_000);
  });

  it("hands the quota back when the reservation insert fails", async () => {
    store.failInsert("upload_reservations", {
      message: "relation upload_reservations does not exist",
    });
    const res = await POST(request(compressedPhoto));

    expect(res.status).toBe(500);
    expect(store.released()).toBe(1_975_000);
  });

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
