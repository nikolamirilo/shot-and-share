import "server-only";

import type { MediaRow } from "@/lib/db/types";
import { type ImageFormat, isUniversallyViewable } from "@/lib/media/formats";
import type { MediaView } from "@/lib/media-view";
import { storage } from "@/lib/storage";

/** What the saved file is called on the guest's device. */
function downloadName(row: MediaRow): string {
  const ext =
    row.media_key.split(".").pop() ?? (row.kind === "video" ? "mp4" : "jpg");
  const stamp = row.created_at.slice(0, 19).replace(/[:T]/g, "-");
  return `shot-and-share-${stamp}.${ext}`;
}

/**
 * A media row as everything that renders it wants to see it.
 *
 * Images go out through the CDN with a long cache: the id is unguessable and
 * the event link is already the access control. The signed URL is kept for
 * downloads and for video playback, so a leaked link stops working.
 */
export async function toMediaView(
  row: MediaRow,
  opts: { withUrl?: boolean } = {},
): Promise<MediaView> {
  const cdn = async (key: string | null) =>
    key
      ? (storage.publicUrl(key) ??
        (await storage.presignDownload({ key, expiresInSeconds: 3600 })))
      : null;

  const posterUrl = await cdn(row.poster_key);

  // A photo still waiting on the worker has no preview: a HEIC uploaded from
  // desktop Chrome is in the bucket but is a broken image icon everywhere that
  // is not Safari, so the grid renders its placeholder until the JPEG lands.
  const viewable =
    !row.media_format || isUniversallyViewable(row.media_format as ImageFormat);

  const fullUrl =
    row.kind === "video" ? null : viewable ? await cdn(row.media_key) : null;

  /*
   * The thumbnail is what a wall of fifty photographs actually loads, at 1-2%
   * of the full copy's bytes. It falls back rather than failing: rows written
   * before migration 0015 have none, and neither does a photo for the seconds
   * between its confirm and its thumbnail landing.
   */
  const thumbUrl = await cdn(row.thumb_key);
  const previewUrl = row.kind === "video" ? posterUrl : (thumbUrl ?? fullUrl);

  const view: MediaView = {
    id: row.id,
    kind: row.kind,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    uploaderFingerprint: row.uploader_fingerprint,
    sizeBytes: row.size_bytes,
    previewUrl,
    fullUrl,
    posterUrl,
    durationSeconds: row.duration_seconds,
    processing: row.processing === "pending",
    format: row.media_format,
  };

  if (opts.withUrl) {
    view.url = await storage.presignDownload({
      key: row.media_key,
      expiresInSeconds: 900,
    });
    // A separate signature: the playback URL must stay inline, or a video
    // downloads instead of playing.
    view.downloadUrl = await storage.presignDownload({
      key: row.media_key,
      expiresInSeconds: 900,
      downloadName: downloadName(row),
    });
  }

  return view;
}

export async function toMediaViews(rows: MediaRow[]): Promise<MediaView[]> {
  return Promise.all(rows.map((row) => toMediaView(row)));
}
