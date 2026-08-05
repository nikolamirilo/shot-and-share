import type { MediaKind } from "@/lib/db/types";
import { MB } from "@/lib/tiers";

/**
 * Key layout. Every object lives under the host who owns it, and then under the
 * event, which is what makes deletion, lifecycle tagging and the ZIP build a
 * single prefix operation.
 *
 *   {owner_id}/{event_id}/{media_id}.{ext}
 *   {owner_id}/{event_id}/{media_id}-poster.{ext}
 *   {owner_id}/{event_id}/archive/{event_id}.zip
 *
 * Owner folders sit at the root of the bucket: there is no wrapper prefix above
 * them, so `aws s3 ls s3://bucket/` lists hosts and nothing else.
 *
 * One object per upload. The compressed copy *is* the photo - there is no
 * separate original and no separate thumbnail, because storing three renditions
 * of the same picture is three times the bill for a difference nobody looking at
 * a phone can see. The only second object in an event folder is a video's poster
 * frame, which is not a copy of anything: a video has no still of itself.
 *
 * S3 has no row level security, so this layout is the tenant boundary in the
 * bucket and application code is what keeps to it. It is enforced a second time
 * as a CHECK constraint in migration 0008 - a key built for the wrong owner
 * fails the insert rather than landing in somebody else's folder.
 */

/**
 * Who an object belongs to. Passed as an object rather than two positional
 * arguments because an owner id and an event id are both uuids: transposing
 * them would produce a perfectly well-formed key pointing at nothing, and no
 * type checker would notice.
 */
export interface EventScope {
  ownerId: string;
  eventId: string;
}

/** Scope from an event row. */
export function scopeOfEvent(event: {
  id: string;
  owner_id: string;
}): EventScope {
  return { ownerId: event.owner_id, eventId: event.id };
}

/** Scope from a media row, which carries its owner denormalised. */
export function scopeOfMedia(row: {
  event_id: string;
  owner_id: string;
}): EventScope {
  return { ownerId: row.owner_id, eventId: row.event_id };
}

/** Everything one host has ever stored. Used when an account is removed. */
export function ownerPrefix(ownerId: string): string {
  return `${ownerId}/`;
}

export function eventPrefix({ ownerId, eventId }: EventScope): string {
  return `${ownerId}/${eventId}/`;
}

/**
 * The one object an upload keeps: the compressed photo, or the video itself.
 *
 * The extension can change over the life of a row - a HEIC the browser could
 * not read is uploaded as-is and replaced by the worker's JPEG - so callers
 * rebuild this key rather than assuming the one they wrote first.
 */
export function mediaKey(
  scope: EventScope,
  mediaId: string,
  ext: string,
): string {
  return `${eventPrefix(scope)}${mediaId}.${ext}`;
}

/** First usable frame of a video, so a gallery never shows a grey box. */
export function posterKey(
  scope: EventScope,
  mediaId: string,
  ext = "webp",
): string {
  return `${eventPrefix(scope)}${mediaId}-poster.${ext}`;
}

export function archiveKey(scope: EventScope): string {
  return `${eventPrefix(scope)}archive/${scope.eventId}.zip`;
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

/** The poster frame pulled out of a video. Small enough for a grid. */
export const POSTER_MAX_EDGE = 720;
export const MAX_POSTER_BYTES = 2 * MB;

export function displayName(mime: string): string {
  return classify(mime)?.kind === "video" ? "video" : "photo";
}

/**
 * Every object belonging to one upload.
 *
 * Two at most now - the media itself and, for a video, its poster. Enumerating
 * them by hand at each delete site is how you end up paying to store the poster
 * frames of videos that were removed months ago, so every caller goes through
 * here.
 */
export function mediaKeys(row: {
  media_key: string;
  poster_key?: string | null;
}): string[] {
  return [row.media_key, row.poster_key].filter((key): key is string =>
    Boolean(key),
  );
}

/** Total bytes a media row is charged for. */
export function mediaBytes(row: {
  size_bytes: number;
  poster_size_bytes?: number | null;
}): number {
  return Number(row.size_bytes) + Number(row.poster_size_bytes ?? 0);
}
