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
 * The thumbnail's preference order.
 *
 * AVIF is deliberately absent. It beats WebP by 15-20% at these sizes, but
 * encoding happens on a guest's phone with thirty photos queued behind it -
 * seconds per image against WebP's milliseconds - and ~7% of devices cannot
 * decode it, so it would need a fallback copy alongside. Worth revisiting
 * server-side once the transcode worker does the encoding.
 */
export const THUMB_IMAGE_FORMATS: ImageFormat[] = ["webp", "jpeg"];

/**
 * The full-size copy is always JPEG, never WebP, and this is not an oversight.
 *
 * Browsers have handled WebP since 2020, so the argument is not about viewing
 * it - it is about what happens after the download. This is the file a host
 * sends to a print shop, opens in photo software or puts on a digital frame,
 * and plenty of all three still refuse WebP. The ~30% it costs against WebP is
 * the price of the file being useful once it leaves us.
 */
export const FULL_IMAGE_FORMAT: ImageFormat = "jpeg";

/**
 * A video's poster frame is always JPEG, never WebP.
 *
 * It used to follow the thumbnail's preference order, which meant WebP almost
 * everywhere. The poster is the only still frame a clip has, so it is also the
 * only thing the moderation check can look at, and Amazon Rekognition reads
 * JPEG and PNG and nothing else. A WebP poster is an unscreenable video.
 *
 * The cost is one slightly larger file per clip, which against a video is
 * nothing.
 */
export const POSTER_IMAGE_FORMATS: ImageFormat[] = ["jpeg"];

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
 * Target bytes per megapixel for the stored copies.
 *
 * Quality is held roughly constant by aiming at a size *budget per pixel*
 * rather than at a fixed encoder quality. A flat quality setting gives a plain
 * sky and a confetti-covered dance floor wildly different file sizes; a budget
 * pushes the encoder harder exactly where there is more going on, which is what
 * "looks the same, weighs less" actually requires.
 *
 * 160,000 is about 1.3 bits per pixel, inside the range where JPEG loss is not
 * visible - and a big image tolerates fewer bits per pixel than a small one,
 * because the detail is spread across more of them. It puts a 12MP photo at
 * roughly the weight of the HEIC it came off the phone as.
 */
export const FULL_BYTES_PER_MP = 160_000;
export const POSTER_BYTES_PER_MP = 150_000;

/** Leaner per pixel than a poster: a thumbnail is never shown full screen. */
export const THUMB_BYTES_PER_MP = 90_000;

/** Never go below this, however busy the photo. Artefacts are not a saving. */
export const MIN_QUALITY = 0.62;
export const MAX_QUALITY = 0.9;
export const START_QUALITY = 0.82;

/**
 * Longest edge of the thumbnail. Covers the Grid, Circles and Masonry layouts
 * at their largest ask; Stack and the lightbox use the full copy instead.
 *
 * There is deliberately no maximum edge for the full copy. Capping it at 2560
 * is what threw away 60% of a 12MP photo, permanently, for a host who wanted
 * to print big or crop in.
 */
export const THUMB_MAX_EDGE = 640;

/** Floor for a thumbnail's budget. The default floor is bigger than its whole budget. */
export const THUMB_MIN_BYTES = 6_000;

export function megapixels(width: number, height: number): number {
  return (width * height) / 1_000_000;
}

export function sizeBudget(
  width: number,
  height: number,
  bytesPerMp: number,
  /**
   * A floor so small images are not squeezed into nothing. A parameter rather
   * than a constant because a thumbnail's entire budget is under the default,
   * which would silently encode every thumbnail bigger than asked for.
   */
  floor = 30_000,
): number {
  return Math.max(floor, Math.round(megapixels(width, height) * bytesPerMp));
}
