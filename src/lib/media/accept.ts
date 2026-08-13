import type { MediaKind } from "@/lib/db/types";
import {
  IMAGE_EXT,
  IMAGE_MIME,
  VIDEO_MIME,
  imageFormatFromMime,
  videoFormatFromMime,
} from "@/lib/media/formats";
import { MB } from "@/lib/tiers";

/**
 * An allowlist, not a blocklist. An unauthenticated upload endpoint invites
 * junk, and the file type check is a cost control as much as a security one.
 *
 * HEIF is the container and HEIC the common profile, so it is an alias rather
 * than a format of its own - but the file input still has to offer it.
 */
const PHOTO_MIME = [...Object.values(IMAGE_MIME), "image/heif"];

export const ACCEPTED_MIME = [...PHOTO_MIME, ...Object.values(VIDEO_MIME)];

/**
 * Extensions, listed beside the MIME types rather than instead of them.
 *
 * A MIME-only `accept` is why a guest can open the picker and find their photos
 * greyed out: the picker matches on the type the operating system reports, and
 * for HEIC that is very often nothing at all. An extension alone loses the iOS
 * camera, which matches on type. Both halves are needed.
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

export function displayName(mime: string): string {
  return classify(mime)?.kind === "video" ? "video" : "photo";
}

/** How many files a guest may pick in one tap of the button. */
export const MAX_FILES_PER_PICK = 30;

/**
 * How many photographs the cover picker asks for at a time. Small on purpose:
 * a host is scanning for one picture they already have in mind, so another tap
 * costs less than pulling a hundred images they will not look at.
 */
export const COVER_PAGE_SIZE = 20;

/** The poster frame pulled out of a video. Small enough for a grid. */
export const POSTER_MAX_EDGE = 720;
export const MAX_POSTER_BYTES = 2 * MB;
