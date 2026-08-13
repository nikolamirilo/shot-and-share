/**
 * Key layout in the bucket:
 *
 *   {owner_id}/{event_id}/{media_id}.{ext}
 *   {owner_id}/{event_id}/{media_id}-poster.{ext}
 *   {owner_id}/{event_id}/archive/{event_id}.zip
 *
 * S3 has no row level security, so this layout is the tenant boundary and
 * application code is what keeps to it. Migration 0008 enforces it a second
 * time as a CHECK constraint.
 */

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

/**
 * The one object an upload keeps. The extension can change over the life of a
 * row - a HEIC the browser could not read is replaced by the worker's JPEG - so
 * callers rebuild this key rather than assuming the one they wrote first.
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
 * Every object belonging to one upload: the media, and a video's poster.
 * Enumerating them by hand at each delete site is how you end up paying to
 * store the posters of videos removed months ago.
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

/**
 * Whether a key may be served unauthenticated by /api/media, and as what.
 *
 * Exactly three segments is the load-bearing part: `{owner}/{event}/archive/
 * {id}.zip` has four, so a 30 GB archive cannot be pulled through the app
 * process by guessing a URL. Video is excluded too - it stays behind a signed
 * URL, because the bytes are worth an expiring link.
 *
 * Returns the Content-Type to serve, or null to refuse.
 */
export function publicImageType(key: string): string | null {
  const match = /^[^/]+\/[^/]+\/[^/]+\.(webp|jpe?g|png|gif|avif)$/i.exec(key);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
}
