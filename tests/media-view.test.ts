import { describe, expect, it, vi } from "vitest";

import type { MediaRow } from "@/lib/db/types";

/**
 * Which stored copy each surface is handed.
 *
 * This is where the two-object layout of migration 0015 actually shows up. Get
 * it wrong in one direction and a wall of fifty photographs pulls fifty
 * full-size JPEGs; get it wrong in the other and the lightbox shows a 640px
 * thumbnail blown up to fill the screen.
 *
 * The fallback matters as much as the split. Rows written before 0015 have no
 * thumbnail and are never backfilled, and neither does a photo for the seconds
 * between its confirm and its thumbnail landing - so "no thumbnail" is a normal
 * state, not an error.
 */

vi.mock("@/lib/storage", () => ({
  storage: {
    publicUrl: (key: string) => `https://cdn.example/${key}`,
    presignDownload: vi.fn(
      async ({ key }: { key: string }) => `https://signed.example/${key}`,
    ),
  },
}));

const { toMediaView } = await import("@/lib/media/view");

const OWNER = "00000000-1111-2222-3333-444444444444";
const EVENT = "11111111-2222-3333-4444-555555555555";
const ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function photo(over: Partial<MediaRow> = {}): MediaRow {
  return {
    id: ID,
    event_id: EVENT,
    owner_id: OWNER,
    kind: "photo",
    media_key: `${OWNER}/${EVENT}/full/${ID}.jpg`,
    thumb_key: `${OWNER}/${EVENT}/thumb/${ID}.webp`,
    poster_key: null,
    size_bytes: 1_950_000,
    thumb_size_bytes: 25_000,
    poster_size_bytes: 0,
    media_format: "jpeg",
    thumb_format: "webp",
    duration_seconds: null,
    processing: "done",
    mime_type: "image/jpeg",
    width: 4032,
    height: 3024,
    uploader_fingerprint: null,
    source: "guest",
    status: "ready",
    created_at: "2026-08-17T12:00:00.000Z",
    ...over,
  } as MediaRow;
}

describe("which copy each surface gets", () => {
  it("previews from the thumbnail and keeps the full copy for the lightbox", async () => {
    const view = await toMediaView(photo());

    expect(view.previewUrl).toContain(`thumb/${ID}.webp`);
    expect(view.fullUrl).toContain(`full/${ID}.jpg`);
  });

  it("falls back to the full copy when there is no thumbnail", async () => {
    const view = await toMediaView(photo({ thumb_key: null }));

    expect(view.previewUrl).toContain(`full/${ID}.jpg`);
    expect(view.fullUrl).toContain(`full/${ID}.jpg`);
  });

  it("serves a row written before the folders existed", async () => {
    // A flat key and no thumbnail. Never backfilled, so it has to keep working.
    const view = await toMediaView(
      photo({
        media_key: `${OWNER}/${EVENT}/${ID}.webp`,
        thumb_key: null,
        media_format: "webp",
      }),
    );

    expect(view.previewUrl).toContain(`${EVENT}/${ID}.webp`);
    expect(view.fullUrl).toContain(`${EVENT}/${ID}.webp`);
  });

  it("shows nothing for a photo the worker has not converted yet", async () => {
    // A HEIC uploaded from desktop Chrome is in the bucket and is a broken
    // image icon everywhere that is not Safari, so the grid holds its
    // placeholder rather than pointing at it.
    const view = await toMediaView(
      photo({
        media_key: `${OWNER}/${EVENT}/full/${ID}.heic`,
        thumb_key: null,
        media_format: "heic",
        processing: "pending",
      }),
    );

    expect(view.previewUrl).toBeNull();
    expect(view.fullUrl).toBeNull();
    expect(view.processing).toBe(true);
  });

  it("uses a clip's poster frame as its preview and offers no full copy", async () => {
    // A video has no thumbnail object of its own, and nothing shows it as a
    // still image - the lightbox plays it from a signed URL instead.
    const view = await toMediaView(
      photo({
        kind: "video",
        media_key: `${OWNER}/${EVENT}/full/${ID}.mp4`,
        thumb_key: null,
        poster_key: `${OWNER}/${EVENT}/${ID}-poster.webp`,
        media_format: "mp4",
        thumb_format: null,
      }),
    );

    expect(view.previewUrl).toContain(`${ID}-poster.webp`);
    expect(view.fullUrl).toBeNull();
  });

  it("points download at the full copy, never the thumbnail", async () => {
    // The whole point of the change: what a host saves is every pixel the
    // camera captured.
    const view = await toMediaView(photo(), { withUrl: true });

    expect(view.downloadUrl).toContain(`full/${ID}.jpg`);
    expect(view.url).toContain(`full/${ID}.jpg`);
  });
});
