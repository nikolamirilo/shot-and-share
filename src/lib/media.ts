import type { MediaKind } from "@/lib/db/types";
import { MB } from "@/lib/tiers";

/**
 * Key layout. Every object lives under its event, which is what makes deletion,
 * lifecycle tagging and the ZIP build a single prefix operation.
 *
 *   events/{event_id}/originals/{media_id}.{ext}
 *   events/{event_id}/display/{media_id}.{ext}
 *   events/{event_id}/thumbs/{media_id}.{ext}
 *   events/{event_id}/posters/{media_id}.{ext}
 *   events/{event_id}/archive/{event_id}.zip
 */

export function originalKey(
  eventId: string,
  mediaId: string,
  ext: string,
): string {
  return `events/${eventId}/originals/${mediaId}.${ext}`;
}

export function thumbKey(eventId: string, mediaId: string, ext = "webp"): string {
  return `events/${eventId}/thumbs/${mediaId}.${ext}`;
}

/** The optimised full-size copy. This is what a lightbox actually loads. */
export function displayKey(
  eventId: string,
  mediaId: string,
  ext: string,
): string {
  return `events/${eventId}/display/${mediaId}.${ext}`;
}

/** First usable frame of a video, so a gallery never shows a grey box. */
export function posterKey(
  eventId: string,
  mediaId: string,
  ext = "webp",
): string {
  return `events/${eventId}/posters/${mediaId}.${ext}`;
}

export function archiveKey(eventId: string): string {
  return `events/${eventId}/archive/${eventId}.zip`;
}

export function eventPrefix(eventId: string): string {
  return `events/${eventId}/`;
}

/**
 * An allowlist, not a blocklist. An unauthenticated upload endpoint invites
 * junk, and the file type check is a cost control as much as a security one.
 */
const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/gif": "gif",
};

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export const ACCEPTED_MIME = [
  ...Object.keys(PHOTO_TYPES),
  ...Object.keys(VIDEO_TYPES),
];

/** What the file input offers. Photos first: that is the common case. */
export const ACCEPT_ATTRIBUTE_PHOTO = Object.keys(PHOTO_TYPES).join(",");
export const ACCEPT_ATTRIBUTE_ALL = ACCEPTED_MIME.join(",");

export function classify(
  mime: string,
): { kind: MediaKind; ext: string } | null {
  const type = mime.toLowerCase().split(";")[0].trim();
  if (PHOTO_TYPES[type]) return { kind: "photo", ext: PHOTO_TYPES[type] };
  if (VIDEO_TYPES[type]) return { kind: "video", ext: VIDEO_TYPES[type] };
  return null;
}

/** Guests upload from a phone. One batch, not one photo at a time. */
export const MAX_FILES_PER_REQUEST = 30;

/** The generated thumbnail. Small enough that the CDN carries the gallery. */
export const THUMB_MAX_EDGE = 720;
export const THUMB_QUALITY = 0.72;
export const MAX_THUMB_BYTES = 2 * MB;

export function displayName(mime: string): string {
  return classify(mime)?.kind === "video" ? "video" : "photo";
}

/**
 * Every object belonging to one upload.
 *
 * A media row can own up to four objects now. Enumerating them by hand at each
 * delete site is how you end up paying to store the renditions of photos that
 * were removed months ago, so every caller goes through here.
 */
export function mediaKeys(row: {
  original_key: string;
  thumb_key?: string | null;
  display_key?: string | null;
  poster_key?: string | null;
}): string[] {
  return [
    row.original_key,
    row.thumb_key,
    row.display_key,
    row.poster_key,
  ].filter((key): key is string => Boolean(key));
}

/** Total bytes a media row is charged for, across every rendition. */
export function mediaBytes(row: {
  size_bytes: number;
  thumb_size_bytes?: number | null;
  display_size_bytes?: number | null;
  poster_size_bytes?: number | null;
}): number {
  return (
    Number(row.size_bytes) +
    Number(row.thumb_size_bytes ?? 0) +
    Number(row.display_size_bytes ?? 0) +
    Number(row.poster_size_bytes ?? 0)
  );
}
