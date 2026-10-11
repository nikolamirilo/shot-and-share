import { type MediaKind } from "@/types/db";
import {
  IMAGE_EXT,
  IMAGE_MIME,
  VIDEO_MIME,
  imageFormatFromMime,
  videoFormatFromMime,
} from "@/lib/media/formats";
import { MB } from "@/lib/tiers";

const PHOTO_MIME = [...Object.values(IMAGE_MIME), "image/heif"];

export const ACCEPTED_MIME = [...PHOTO_MIME, ...Object.values(VIDEO_MIME)];

/**
 * A MIME-only `accept` greys out HEIC: pickers match on the type the OS reports, which
 * for HEIC is often nothing.
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
 * Recent iOS hands the accept list to the system photo picker, which silently drops
 * anything it cannot resolve - a bare extension, or a type it has no mapping for.
 */
export const SAFARI_ACCEPT_PHOTO = "image/*";
export const SAFARI_ACCEPT_ALL = "image/*,video/*";

/**
 * The iPad reports itself as a Mac, and Chrome and Edge put "Safari" in their own user
 * agents - so they are ruled out by name.
 */
export function isSafari(ua: string | undefined | null): boolean {
  if (!ua) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|Chrome\/|Chromium|Edg\/|OPR\//.test(ua)) {
    return false;
  }
  return /Safari\//.test(ua) || /iPhone|iPad|iPod/.test(ua);
}

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

/** In-app browsers (WKWebView) hand over one photo at a time on several iOS builds. */
const IN_APP = [
  ["Instagram", "Instagram"],
  ["FBAN", "Facebook"],
  ["FBAV", "Facebook"],
  ["FB_IAB", "Facebook"],
  ["Messenger", "Messenger"],
  ["WhatsApp", "WhatsApp"],
  ["Viber", "Viber"],
  ["Snapchat", "Snapchat"],
  ["TikTok", "TikTok"],
  ["BytedanceWebview", "TikTok"],
  ["Twitter", "X"],
  ["LinkedInApp", "LinkedIn"],
  ["Line/", "LINE"],
  ["MicroMessenger", "WeChat"],
  ["Telegram", "Telegram"],
] as const;

export function inAppBrowser(ua: string | undefined | null): string | null {
  if (!ua) return null;
  for (const [needle, name] of IN_APP) {
    if (ua.includes(needle)) return name;
  }
  return null;
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

export const COVER_PAGE_SIZE = 20;

export const POSTER_MAX_EDGE = 720;
export const MAX_POSTER_BYTES = 2 * MB;

export const MAX_THUMB_BYTES = 512 * 1024;
