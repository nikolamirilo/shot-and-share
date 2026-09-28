/**
 * Key layout in the bucket:
 *
 *   {owner_id}/{event_id}/photos/full/{media_id}.{ext}
 *   {owner_id}/{event_id}/photos/thumb/{media_id}.{ext}
 *   {owner_id}/{event_id}/videos/full/{media_id}.{ext}
 *   {owner_id}/{event_id}/videos/poster/{media_id}.{ext}
 *   {owner_id}/{event_id}/archive/{event_id}.zip
 *
 * Photos and videos live in folders of their own, so an event's clips can be
 * listed, measured or moved to another storage class without touching its
 * photos. Rows written before the split keep `full/`, `thumb/` and
 * `{media_id}-poster` directly under the event; every key is read off the row,
 * so they keep working and are not moved.
 *
 * The folder is `full`, not `original`. What is in it is a re-encode - for an
 * iPhone photo a different format entirely - and a name that contradicts its
 * contents is how the next person reintroduces the bug.
 *
 * Rows written before the folders existed keep a flat
 * {owner_id}/{event_id}/{media_id}.{ext} and have no thumbnail. They are not
 * backfilled, so every reader has to cope with both.
 *
 * S3 has no row level security, so this layout is the tenant boundary and
 * application code is what keeps to it. Migration 0008 enforces the owner
 * prefix a second time as a CHECK constraint, and 0016 extends it to the
 * thumbnail.
 */

import type { MediaKind } from "@/lib/db/types";

/**
 * Passed as an object rather than two positional arguments: both ids are
 * uuids, so transposing them would build a well-formed key pointing at nothing.
 */
export interface EventScope {
  ownerId: string;
  eventId: string;
}

export function scopeOfEvent(event: {
  id: string;
  owner_id: string;
}): EventScope {
  return { ownerId: event.owner_id, eventId: event.id };
}

/** Media rows carry their owner denormalised, so they can build their own keys. */
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

/** The folder one kind of upload lives in: `photos/` or `videos/`. */
export function kindPrefix(scope: EventScope, kind: MediaKind): string {
  return `${eventPrefix(scope)}${kind === "video" ? "videos" : "photos"}/`;
}

/**
 * The full-size copy: every pixel the camera captured, as a JPEG.
 *
 * The extension can change over the life of a row - a HEIC the browser could
 * not read is replaced by the worker's JPEG - so callers rebuild this key
 * rather than assuming the one they wrote first.
 */
export function mediaKey(
  scope: EventScope,
  kind: MediaKind,
  mediaId: string,
  ext: string,
): string {
  return `${kindPrefix(scope, kind)}full/${mediaId}.${ext}`;
}

/**
 * The small copy the gallery grid loads fifty of at once. Photos only: a
 * video's poster frame already does this job.
 */
export function thumbKey(
  scope: EventScope,
  mediaId: string,
  ext = "webp",
): string {
  return `${kindPrefix(scope, "photo")}thumb/${mediaId}.${ext}`;
}

/** First usable frame of a video, so a gallery never shows a grey box. */
export function posterKey(
  scope: EventScope,
  mediaId: string,
  ext = "webp",
): string {
  return `${kindPrefix(scope, "video")}poster/${mediaId}.${ext}`;
}

export function archiveKey(scope: EventScope): string {
  return `${eventPrefix(scope)}archive/${scope.eventId}.zip`;
}

/**
 * Every object belonging to one upload: the full copy, its thumbnail, and a
 * video's poster. Enumerating them by hand at each delete site is how you end
 * up paying to store the thumbnails of photos removed months ago.
 */
export function mediaKeys(row: {
  media_key: string;
  thumb_key?: string | null;
  poster_key?: string | null;
}): string[] {
  return [row.media_key, row.thumb_key, row.poster_key].filter(
    (key): key is string => Boolean(key),
  );
}

/** Total bytes a media row is charged for. */
export function mediaBytes(row: {
  size_bytes: number;
  thumb_size_bytes?: number | null;
  poster_size_bytes?: number | null;
}): number {
  return (
    Number(row.size_bytes) +
    Number(row.thumb_size_bytes ?? 0) +
    Number(row.poster_size_bytes ?? 0)
  );
}

/**
 * Whether a key may be served unauthenticated by /api/media, and as what.
 *
 * The folder allowlist is the load-bearing part. `photos/full/`,
 * `photos/thumb/` and `videos/poster/` are named, as are the `full/` and
 * `thumb/` of rows written before the split; anything else under an event -
 * `archive/{id}.zip` and `videos/full/` above all - is refused, so a 30 GB archive cannot be pulled through the app process by
 * guessing a URL. This used to be a count of path segments, which stopped
 * working the moment photos gained a folder of their own.
 *
 * The folder is optional so that posters, and rows written before the folders
 * existed, still resolve.
 *
 * Video is excluded too - it stays behind a signed URL, because the bytes are
 * worth an expiring link.
 *
 * Returns the Content-Type to serve, or null to refuse.
 */
export function publicImageType(key: string): string | null {
  const match =
    /^[^/]+\/[^/]+\/(?:(?:photos\/full|photos\/thumb|videos\/poster|full|thumb)\/)?[^/]+\.(webp|jpe?g|png|gif|avif)$/i.exec(
      key,
    );
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
}
