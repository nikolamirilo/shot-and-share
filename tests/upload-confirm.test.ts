import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";
import { TIERS } from "@/lib/tiers";

/**
 * The confirm endpoint: the only place a media row is ever created.
 *
 * Everything worth testing here is about what happens when something has
 * already gone wrong. The bytes are in the bucket by the time this runs, so the
 * failure modes are all variations on "the row and the object disagree" - and
 * each one of those is either a photo the host never sees or quota they paid
 * for and cannot use.
 */

const store = createStore();

const EVENT = {
  id: "11111111-2222-3333-4444-555555555555",
  owner_id: "00000000-1111-2222-3333-444444444444",
  tier: TIERS.plus.id,
  status: "active",
  storage_quota_bytes: 2 * 1024 ** 3,
  storage_used_bytes: 0,
};

const FINGERPRINT = "f".repeat(16);
const MEDIA_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

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

const { POST } = await import("@/app/api/upload/confirm/route");

/** A photo waiting to be confirmed. */
function reserve(over: Record<string, unknown> = {}) {
  store.rows("upload_reservations").push({
    id: MEDIA_ID,
    event_id: EVENT.id,
    owner_id: EVENT.owner_id,
    media_key: `${EVENT.owner_id}/${EVENT.id}/full/${MEDIA_ID}.jpg`,
    thumb_key: `${EVENT.owner_id}/${EVENT.id}/thumb/${MEDIA_ID}.webp`,
    poster_key: null,
    size_bytes: 1_950_000,
    thumb_size_bytes: 25_000,
    poster_size_bytes: 0,
    media: {
      kind: "photo",
      mime_type: "image/jpeg",
      media_format: "jpeg",
      thumb_format: "webp",
      duration_seconds: null,
      width: 4032,
      height: 3024,
      processing: "done",
      uploader_fingerprint: FINGERPRINT,
    },
    created_at: new Date().toISOString(),
    ...over,
  });
}

/** A video, whose poster is a second object that can fail on its own. */
function reserveVideo() {
  reserve({
    media_key: `${EVENT.owner_id}/${EVENT.id}/full/${MEDIA_ID}.mov`,
    // A clip has no thumbnail of its own: its poster frame is the small copy.
    thumb_key: null,
    poster_key: `${EVENT.owner_id}/${EVENT.id}/${MEDIA_ID}-poster.webp`,
    size_bytes: 8_000_000,
    thumb_size_bytes: 0,
    poster_size_bytes: 40_000,
    media: {
      kind: "video",
      mime_type: "video/quicktime",
      media_format: "mov",
      thumb_format: null,
      duration_seconds: 12,
      width: 1920,
      height: 1080,
      processing: "pending",
      uploader_fingerprint: FINGERPRINT,
    },
  });
}

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/upload/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "a".repeat(32),
      fingerprint: FINGERPRINT,
      mediaId: MEDIA_ID,
      ...body,
    }),
  });
}

const media = () => store.rows("media");
const reservations = () => store.rows("upload_reservations");

beforeEach(() => {
  store.reset();
});

describe("confirming an upload", () => {
  it("writes the media row and tears up the reservation", async () => {
    reserve();
    const res = await POST(
      request({
        mediaUploaded: true,
        thumbUploaded: true,
        width: 4032,
        height: 3024,
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ confirmed: true });

    expect(media()).toHaveLength(1);
    const row = media()[0];
    expect(row.id).toBe(MEDIA_ID);
    expect(row.status).toBe("ready");
    expect(row.size_bytes).toBe(1_950_000);
    expect(row.media_key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/full/${MEDIA_ID}.jpg`,
    );
    // owner_id is filled by a trigger; writing it here would be rejected.
    expect(row).not.toHaveProperty("owner_id");

    expect(reservations()).toHaveLength(0);
    expect(store.released()).toBe(0);
  });

  it("writes nothing and refunds everything when the upload failed", async () => {
    reserveVideo();
    const res = await POST(request({ failed: true, mediaUploaded: false }));

    expect(await res.json()).toEqual({ confirmed: false });
    expect(media()).toHaveLength(0);
    expect(reservations()).toHaveLength(0);
    // The clip and its poster were both charged for at presign time.
    expect(store.released()).toBe(8_040_000);
  });

  /**
   * The bytes go from the phone to the bucket without passing through us, so a
   * failure between the two leaves no request of ours to inspect: presign
   * answers 200 and confirm turns up seconds later saying it did not work.
   * Whether that was one guest's wifi or a bucket refusing every upload at
   * every event - stale CORS rules after a rename do exactly that - is only
   * answerable if the browser says which, and it is only visible if we write it
   * down.
   */
  it("records why an upload never reached storage", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    reserve();

    await POST(
      request({
        failed: true,
        mediaUploaded: false,
        reason:
          "Could not reach storage. The bucket's CORS rules may not allow this site.",
      }),
    );

    expect(logged).toHaveBeenCalledWith(
      "[confirm] upload did not reach storage",
      expect.objectContaining({
        eventId: EVENT.id,
        reason: expect.stringContaining("CORS"),
      }),
    );

    logged.mockRestore();
  });

  it("says so plainly when the browser reported no reason at all", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    reserve();

    await POST(request({ failed: true, mediaUploaded: false }));

    expect(logged).toHaveBeenCalledWith(
      "[confirm] upload did not reach storage",
      expect.objectContaining({ reason: "not reported" }),
    );

    logged.mockRestore();
  });

  it("keeps the clip and refunds only the poster when the poster failed", async () => {
    reserveVideo();
    const res = await POST(
      request({ mediaUploaded: true, posterUploaded: false }),
    );

    expect(await res.json()).toEqual({ confirmed: true });

    const row = media()[0];
    expect(row.poster_key).toBeNull();
    expect(row.poster_size_bytes).toBe(0);
    expect(row.size_bytes).toBe(8_000_000);
    // A poster that never arrived must not keep costing the host anything.
    expect(store.released()).toBe(40_000);
  });

  it("keeps the poster when it did arrive", async () => {
    reserveVideo();
    await POST(request({ mediaUploaded: true, posterUploaded: true }));

    const row = media()[0];
    expect(row.poster_key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/${MEDIA_ID}-poster.webp`,
    );
    expect(row.poster_size_bytes).toBe(40_000);
    expect(store.released()).toBe(0);
  });

  it("writes the thumbnail onto the media row", async () => {
    reserve();
    await POST(request({ mediaUploaded: true, thumbUploaded: true }));

    const row = media()[0];
    expect(row.thumb_key).toBe(
      `${EVENT.owner_id}/${EVENT.id}/thumb/${MEDIA_ID}.webp`,
    );
    expect(row.thumb_size_bytes).toBe(25_000);
    expect(row.thumb_format).toBe("webp");
    expect(store.released()).toBe(0);
  });

  it("keeps the photo when only the thumbnail failed, and refunds it", async () => {
    // The grid falls back to the full copy, which is what a row written before
    // migration 0016 does anyway. Losing the photograph over its 25 KB
    // thumbnail would be the worst trade in the system.
    reserve();
    const res = await POST(
      request({ mediaUploaded: true, thumbUploaded: false }),
    );

    expect(await res.json()).toEqual({ confirmed: true });

    const row = media()[0];
    expect(row.thumb_key).toBeNull();
    expect(row.thumb_size_bytes).toBe(0);
    expect(row.thumb_format).toBeNull();
    expect(row.size_bytes).toBe(1_950_000);
    expect(store.released()).toBe(25_000);
  });

  it("refunds both copies when the photo itself never reached storage", async () => {
    // The whole promise goes back, thumbnail included. Refunding only the full
    // copy leaks 25 KB of a host's quota per abandoned upload.
    reserve();
    const res = await POST(
      request({ mediaUploaded: false, thumbUploaded: false, failed: true }),
    );

    expect(await res.json()).toEqual({ confirmed: false });
    expect(media()).toHaveLength(0);
    expect(store.released()).toBe(1_975_000);
  });

  /**
   * The browser retries a confirm that failed on a flaky connection. By then
   * the bytes are already in the bucket, so answering the second call with a
   * failure would throw away a photo over a lost acknowledgement.
   */
  it("is safe to call twice", async () => {
    reserve();
    await POST(request({ mediaUploaded: true }));
    const again = await POST(request({ mediaUploaded: true }));

    expect(await again.json()).toEqual({ confirmed: true });
    expect(media()).toHaveLength(1);
  });

  it("treats a duplicate key as the photo already being there", async () => {
    reserve();
    store.failInsert("media", {
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });

    const res = await POST(request({ mediaUploaded: true }));

    expect(await res.json()).toEqual({ confirmed: true });
    expect(reservations()).toHaveLength(0);
  });

  /**
   * The reservation is the only record that the bytes were ever charged for. If
   * the insert fails for a real reason it has to stay exactly where it is: the
   * browser can retry against it, and the nightly sweep refunds it if the guest
   * has gone. Deleting it here would lose the quota permanently.
   */
  it("leaves the reservation alone when the insert fails for a real reason", async () => {
    reserve();
    store.failInsert("media", { message: "connection reset" });

    const res = await POST(request({ mediaUploaded: true }));

    expect(res.status).toBe(500);
    expect(media()).toHaveLength(0);
    expect(reservations()).toHaveLength(1);
    expect(store.released()).toBe(0);
  });

  it("will not let one guest confirm another's upload", async () => {
    reserve();
    const res = await POST(
      request({ fingerprint: "0".repeat(16), mediaUploaded: true }),
    );

    expect(await res.json()).toEqual({ confirmed: false });
    expect(media()).toHaveLength(0);
    // And it does not refund somebody else's reservation either.
    expect(reservations()).toHaveLength(1);
    expect(store.released()).toBe(0);
  });

  it("reports honestly when the reservation has already been swept", async () => {
    const res = await POST(request({ mediaUploaded: true }));

    expect(await res.json()).toEqual({ confirmed: false });
    expect(media()).toHaveLength(0);
  });
});
