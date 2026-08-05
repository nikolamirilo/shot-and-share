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
 * Formats a host can hand to anybody - open it on a ten-year-old Windows
 * laptop, attach it to an email, put it in a print order - and it works.
 *
 * HEIC is the one that matters here. iPhones produce it by default, it is
 * roughly half the size of the equivalent JPEG, and Chrome, Firefox and
 * Windows Photo Viewer cannot open it. A host who downloads a ZIP of HEIC
 * files on a Windows machine has been handed nothing, which is why an
 * openable copy is generated rather than treated as an optimisation.
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
 * AVIF is deliberately absent, and it is the interesting omission. It beats
 * WebP by roughly 15 to 20 percent at these sizes, but:
 *
 *   - Encoding it happens on a guest's phone, at a wedding, with thirty photos
 *     queued behind it. AVIF encode is seconds per image where WebP is
 *     milliseconds, and a guest who waits does not finish uploading.
 *   - Around 7 percent of devices still cannot decode it, so shipping AVIF as
 *     the only stored copy breaks the promise that everyone can view and
 *     download. Keeping a second fallback copy doubles storage and upload time
 *     to save 15 percent on a file already four times smaller than the source.
 *
 * The win here comes overwhelmingly from resizing and quality targeting, not
 * from the last codec generation. When the transcode worker is deployed and
 * encoding is no longer on a phone, AVIF becomes worth revisiting server-side.
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
 * Target bytes per megapixel for the optimised copy.
 *
 * Quality is held roughly constant by aiming at a size *budget per pixel*
 * rather than at a fixed encoder quality. A flat quality setting gives a plain
 * sky and a confetti-covered dance floor wildly different file sizes; a budget
 * pushes the encoder harder exactly where there is more going on, which is what
 * "looks the same, weighs less" actually requires.
 */
export const DISPLAY_BYTES_PER_MP = 260_000;
export const THUMB_BYTES_PER_MP = 150_000;

/** Never go below this, however busy the photo. Artefacts are not a saving. */
export const MIN_QUALITY = 0.62;
export const MAX_QUALITY = 0.9;
export const START_QUALITY = 0.82;

/** Longest edge of the stored copy. Comfortable on a 4K screen and for A4. */
export const DISPLAY_MAX_EDGE = 2560;

/** Re-encoding below this saves nothing worth the risk of touching it. */
export const MIN_COMPRESSIBLE_BYTES = 120_000;

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

/**
 * Only worth keeping the re-encoded copy if it is meaningfully smaller. A
 * 5 percent saving is not worth having re-encoded somebody's photograph.
 */
export const WORTHWHILE_SAVING = 0.15;

export function isWorthKeeping(
  originalBytes: number,
  encodedBytes: number,
): boolean {
  if (originalBytes < MIN_COMPRESSIBLE_BYTES) return false;
  return encodedBytes < originalBytes * (1 - WORTHWHILE_SAVING);
}
