import { type MediaKind } from "@/types/db";

/**
 * An object rather than two positional arguments: both ids are uuids, so transposing
 * them would build a well-formed key to the wrong place.
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

export function scopeOfMedia(row: {
  event_id: string;
  owner_id: string;
}): EventScope {
  return { ownerId: row.owner_id, eventId: row.event_id };
}

export function ownerPrefix(ownerId: string): string {
  return `${ownerId}/`;
}

export function eventPrefix({ ownerId, eventId }: EventScope): string {
  return `${ownerId}/${eventId}/`;
}

export function kindPrefix(scope: EventScope, kind: MediaKind): string {
  return `${eventPrefix(scope)}${kind === "video" ? "videos" : "photos"}/`;
}

export function mediaKey(
  scope: EventScope,
  kind: MediaKind,
  mediaId: string,
  ext: string,
): string {
  return `${kindPrefix(scope, kind)}full/${mediaId}.${ext}`;
}

export function thumbKey(
  scope: EventScope,
  mediaId: string,
  ext = "webp",
): string {
  return `${kindPrefix(scope, "photo")}thumb/${mediaId}.${ext}`;
}

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

export function mediaKeys(row: {
  media_key: string;
  thumb_key?: string | null;
  poster_key?: string | null;
}): string[] {
  return [row.media_key, row.thumb_key, row.poster_key].filter(
    (key): key is string => Boolean(key),
  );
}

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
 * The folder allowlist is the load-bearing part: anything other than the named
 * image folders is refused, so a 30 GB archive cannot be pulled through the app
 * by guessing a URL. Video stays behind a signed URL.
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
