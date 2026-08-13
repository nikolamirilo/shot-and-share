import type { MediaKind } from "@/lib/db/types";
import {
  IMAGE_EXT,
  IMAGE_MIME,
  VIDEO_MIME,
  imageFormatFromMime,
  videoFormatFromMime,
} from "@/lib/media-formats";
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
 *
 * The table itself lives in @/lib/media-formats. There used to be a second copy
 * here, and the two had already disagreed: this one gave `image/heif` the
 * extension "heif" while the other folded HEIF into HEIC and said "heic".
 * upload/presign imports from both, so which extension a HEIF got depended on
 * which branch of that route ran.
 *
 * HEIF is the container and HEIC the common profile, so it is an alias rather
 * than a format of its own - but it still has to be offered by the file input,
 * which is why the accept list adds it back.
 */
const PHOTO_MIME = [...Object.values(IMAGE_MIME), "image/heif"];

export const ACCEPTED_MIME = [...PHOTO_MIME, ...Object.values(VIDEO_MIME)];

/**
 * Extensions, listed beside the MIME types rather than instead of them.
 *
 * A MIME-only `accept` is the reason a guest can open the picker, see their
 * photos greyed out and be unable to select any of them. The picker matches a
 * file against the list using the type the *operating system* reports, and for
 * HEIC that is very often nothing at all - Windows and most Android builds have
 * no mapping for it, so `image/heic` matches no file on the device. The
 * extension is the only thing that is always there.
 *
 * Both halves are needed. An extension alone loses the camera on iOS, which
 * hands back a capture with a name but matches on type.
 */
const PHOTO_EXT = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".heic",
  ".heif",
];

const VIDEO_EXT = [".mp4", ".mov", ".m4v", ".webm"];

/** What the file input offers. Photos first: that is the common case. */
export const ACCEPT_ATTRIBUTE_PHOTO = [...PHOTO_MIME, ...PHOTO_EXT].join(",");
export const ACCEPT_ATTRIBUTE_ALL = [
  ...ACCEPTED_MIME,
  ...PHOTO_EXT,
  ...VIDEO_EXT,
].join(",");

export function classify(
  mime: string,
): { kind: MediaKind; ext: string } | null {
  const image = imageFormatFromMime(mime);
  if (image) return { kind: "photo", ext: IMAGE_EXT[image] };

  // A VideoFormat id is its own extension: "mp4", "webm", "mov".
  const video = videoFormatFromMime(mime);
  if (video) return { kind: "video", ext: video };

  return null;
}

/**
 * How many files a guest may pick at once.
 *
 * Not a request size any more: each file is presigned and confirmed on its own
 * so that uploading can start before the last one has finished compressing.
 * This is the cap on one tap of the button.
 */
export const MAX_FILES_PER_PICK = 30;

/**
 * How many photographs the cover picker asks for at a time.
 *
 * Small on purpose. These are 64px swatches in a narrow column beside a live
 * preview, and a host is scanning for one picture they already have in mind
 * rather than reading the gallery - so the cost of another tap is lower than
 * the cost of pulling a hundred images they will not look at.
 */
export const COVER_PAGE_SIZE = 20;

/** The poster frame pulled out of a video. Small enough for a grid. */
export const POSTER_MAX_EDGE = 720;
export const MAX_POSTER_BYTES = 2 * MB;

export function displayName(mime: string): string {
  return classify(mime)?.kind === "video" ? "video" : "photo";
}

/**
 * Whether a key may be served unauthenticated by /api/media, and as what.
 *
 * The gallery needs a stable, cacheable address for each photo so the image
 * optimiser has something to key on. That address is public - the key is three
 * uuids and the event link is the access control, the same posture a CDN in
 * front of the bucket would have.
 *
 * What it must never serve is anything that is not a gallery image. Exactly
 * three segments is the load-bearing part: `{owner}/{event}/archive/{id}.zip`
 * has four, so a 30 GB archive cannot be pulled through the app process by
 * guessing a URL. Video is excluded too - it stays behind a signed URL, where
 * an expiring link is worth the cost because the bytes are.
 *
 * Returns the Content-Type to serve, or null to refuse.
 */
export function publicImageType(key: string): string | null {
  const match = /^[^/]+\/[^/]+\/[^/]+\.(webp|jpe?g|png|gif|avif)$/i.exec(key);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
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
