/**
 * Image and video formats, and which of them every device can actually open.
 *
 * This is shared by the browser encoder, the server, and the transcode worker,
 * so that "what format is this and can the person on the other end see it?" has
 * exactly one answer in the codebase.
 */

export type ImageFormat = "avif" | "webp" | "jpeg" | "png" | "gif" | "heic";
export type VideoFormat = "mp4" | "webm" | "mov";

export const IMAGE_MIME: Record<ImageFormat, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  heic: "image/heic",
};

export const VIDEO_MIME: Record<VideoFormat, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export const IMAGE_EXT: Record<ImageFormat, string> = {
  avif: "avif",
  webp: "webp",
  jpeg: "jpg",
  png: "png",
  gif: "gif",
  heic: "heic",
};

/**
 * Formats a host can hand to anybody and it works.
 *
 * HEIC is the one that matters: iPhones produce it by default and Chrome,
 * Firefox and Windows Photo Viewer cannot open it. A host who downloads a ZIP
 * of HEIC files on Windows has been handed nothing, which is why an openable
 * copy is generated rather than treated as an optimisation.
 */
export const UNIVERSAL_IMAGE_FORMATS: ImageFormat[] = [
  "jpeg",
  "png",
  "gif",
  "webp",
];

export function isUniversallyViewable(format: ImageFormat): boolean {
  return UNIVERSAL_IMAGE_FORMATS.includes(format);
}

/**
 * Preference order for the copies we generate and store.
 *
 * AVIF is deliberately absent. It beats WebP by 15-20% at these sizes, but
 * encoding happens on a guest's phone with thirty photos queued behind it -
 * seconds per image against WebP's milliseconds - and ~7% of devices cannot
 * decode it, so it would need a fallback copy alongside. Worth revisiting
 * server-side once the transcode worker does the encoding.
 */
export const PREFERRED_IMAGE_FORMATS: ImageFormat[] = ["webp", "jpeg"];

/**
 * H.264 in an MP4 container with AAC audio. Not the most efficient combination
 * available, and that is the point: it is the only one that plays on every
 * phone, browser, smart TV and laptop without a codec conversation.
 */
export const UNIVERSAL_VIDEO_FORMAT: VideoFormat = "mp4";

export function imageFormatFromMime(mime: string): ImageFormat | null {
  const type = normaliseMime(mime);
  const entry = Object.entries(IMAGE_MIME).find(([, m]) => m === type);
  if (entry) return entry[0] as ImageFormat;
  // HEIF is the container, HEIC the common profile. Treat them as one thing.
  if (type === "image/heif") return "heic";
  return null;
}

export function videoFormatFromMime(mime: string): VideoFormat | null {
  const type = normaliseMime(mime);
  const entry = Object.entries(VIDEO_MIME).find(([, m]) => m === type);
  return entry ? (entry[0] as VideoFormat) : null;
}

export function normaliseMime(mime: string): string {
  return mime.toLowerCase().split(";")[0].trim();
}

/* -------------------------------------------------------------------------- */

/**
 * Target bytes per megapixel for the stored copy.
 *
 * Quality is held roughly constant by aiming at a size *budget per pixel*
 * rather than at a fixed encoder quality. A flat quality setting gives a plain
 * sky and a confetti-covered dance floor wildly different file sizes; a budget
 * pushes the encoder harder exactly where there is more going on, which is what
 * "looks the same, weighs less" actually requires.
 */
export const COMPRESSED_BYTES_PER_MP = 260_000;
export const POSTER_BYTES_PER_MP = 150_000;

/** Never go below this, however busy the photo. Artefacts are not a saving. */
export const MIN_QUALITY = 0.62;
export const MAX_QUALITY = 0.9;
export const START_QUALITY = 0.82;

/** Longest edge of the stored copy. Comfortable on a 4K screen and for A4. */
export const COMPRESSED_MAX_EDGE = 2560;

export function megapixels(width: number, height: number): number {
  return (width * height) / 1_000_000;
}

export function sizeBudget(
  width: number,
  height: number,
  bytesPerMp: number,
): number {
  // A floor so small images are not squeezed into nothing.
  return Math.max(30_000, Math.round(megapixels(width, height) * bytesPerMp));
}
