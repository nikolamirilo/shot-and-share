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

/**
 * The wildcards come first, and they are the half that actually works on a
 * phone.
 *
 * A mobile picker reads an exact list as "only these", and matches it against
 * the type the operating system reports for each item in the camera roll -
 * which for video is frequently not one of ours, and for HEIC is frequently
 * nothing at all. The symptom is a guest on a plan that includes video opening
 * the picker at a party and finding every clip greyed out.
 *
 * `image/*` and `video/*` are the form phones handle reliably. The exact types
 * and the extensions stay behind them for desktop file managers, which match on
 * whichever half they happen to support.
 *
 * This widens what can be *picked*, not what can be *stored*: the presign route
 * is still the allowlist, and something exotic gets a clear refusal instead of
 * a file that cannot be selected at all.
 */
export const ACCEPT_ATTRIBUTE_PHOTO = [
  "image/*",
  ...PHOTO_MIME,
  ...PHOTO_EXT,
].join(",");

export const ACCEPT_ATTRIBUTE_ALL = [
  "image/*",
  "video/*",
  ...ACCEPTED_MIME,
  ...PHOTO_EXT,
  ...VIDEO_EXT,
].join(",");

/**
 * The same two lists, cut down to what Safari's picker can act on.
 *
 * Recent iOS hands the accept list to the system photo picker, which wants
 * types it can resolve. Anything it cannot - a bare extension like `.heic`, or
 * a type it has no mapping for - is not ignored the way older versions ignored
 * it: the sheet still opens and still shows the camera roll, but the button
 * that confirms the selection does nothing when it is tapped. A guest sees
 * their photos, taps them, taps Add, and lands back on the page with nothing
 * happening.
 *
 * Two wildcards is all Safari needs, and the two of them cover every file this
 * product takes. The long list stays for the browsers that use it properly.
 */
export const SAFARI_ACCEPT_PHOTO = "image/*";
export const SAFARI_ACCEPT_ALL = "image/*,video/*";

/**
 * Safari, on any device - the iPad reports itself as a Mac, and desktop Safari
 * shares the picker code that iOS uses.
 *
 * Chrome and Edge put "Safari" in their own user agent strings, so they have to
 * be ruled out by name. Deliberately not a feature test: what is being detected
 * is how a native sheet reads an attribute, which nothing in the page can see.
 */
export function isSafari(ua: string | undefined | null): boolean {
  if (!ua) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|Chrome\/|Chromium|Edg\/|OPR\//.test(ua)) {
    return false;
  }
  return /Safari\//.test(ua) || /iPhone|iPad|iPod/.test(ua);
}

/**
 * What to put on the file input, for this browser and this plan.
 *
 * Kept as one pure function of the user agent so the choice is testable
 * without a browser, and so both pickers in the product make it the same way.
 */
export function acceptAttribute({
  video,
  ua,
}: {
  video: boolean;
  ua?: string | null;
}): string {
  if (isSafari(ua)) return video ? SAFARI_ACCEPT_ALL : SAFARI_ACCEPT_PHOTO;
  return video ? ACCEPT_ATTRIBUTE_ALL : ACCEPT_ATTRIBUTE_PHOTO;
}

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

/**
 * How many photographs the cover picker asks for at a time. Small on purpose:
 * a host is scanning for one picture they already have in mind, so another tap
 * costs less than pulling a hundred images they will not look at.
 */
export const COVER_PAGE_SIZE = 20;

/** The poster frame pulled out of a video. Small enough for a grid. */
export const POSTER_MAX_EDGE = 720;
export const MAX_POSTER_BYTES = 2 * MB;

/**
 * A ceiling on the thumbnail a browser may claim it produced.
 *
 * Generous against a real 640px thumbnail, which is 20-40 KB. It exists so a
 * crafted request cannot reserve a host's whole quota by declaring a 2 GB
 * thumbnail, not to police the encoder.
 */
export const MAX_THUMB_BYTES = 512 * 1024;
