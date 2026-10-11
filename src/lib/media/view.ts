import "server-only";

import { type MediaRow } from "@/types/db";
import { type ImageFormat, isUniversallyViewable } from "@/lib/media/formats";
import { type MediaView } from "@/types/media";
import { storage } from "@/lib/storage";
import { mediaExt, mediaStamp } from "@/utils/media-name";

function downloadName(row: MediaRow): string {
  const ext = mediaExt(row, row.kind === "video" ? "mp4" : "jpg");
  return `shot-and-share-${mediaStamp(row)}.${ext}`;
}

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

  // A HEIC still waiting on the worker is a broken image icon outside Safari, so the
  // grid renders its placeholder until the JPEG lands.
  const viewable =
    !row.media_format || isUniversallyViewable(row.media_format as ImageFormat);

  const fullUrl =
    row.kind === "video" ? null : viewable ? await cdn(row.media_key) : null;

  const thumbUrl = await cdn(row.thumb_key);
  const previewUrl = row.kind === "video" ? posterUrl : (thumbUrl ?? fullUrl);

  const view: MediaView = {
    id: row.id,
    kind: row.kind,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    // Absent until migration 0024 has run, so the arrival time stands in.
    takenAt: row.sort_taken_at ?? row.created_at,
    uploaderFingerprint: row.uploader_fingerprint,
    sizeBytes: row.size_bytes,
    previewUrl,
    fullUrl,
    posterUrl,
    durationSeconds: row.duration_seconds,
    processing: row.processing === "pending",
    format: row.media_format,
  };

  if (row.review_state !== "approved") {
    view.review = {
      state: row.review_state,
      labels: (row.moderation_labels ?? []).map((label) => label.name),
      reports: row.report_count,
    };
  }

  if (opts.withUrl) {
    view.url = await storage.presignDownload({
      key: row.media_key,
      expiresInSeconds: 900,
    });
    // A separate signature: the playback URL must stay inline, or a video downloads.
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
