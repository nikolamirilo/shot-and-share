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
 * HEIC is the one that matters: iPhones produce it by default and Chrome, Firefox and
 * Windows Photo Viewer cannot open it.
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
 * AVIF is deliberately absent: it beats WebP at these sizes but costs seconds per
 * encode on a phone.
 */
export const THUMB_IMAGE_FORMATS: ImageFormat[] = ["webp", "jpeg"];

/**
 * Always JPEG, never WebP: this is the copy a host downloads and prints from, and some
 * desktop software still will not open WebP.
 */
export const FULL_IMAGE_FORMAT: ImageFormat = "jpeg";

/**
 * Always JPEG, never WebP: a poster frame is rendered by things that do not all decode
 * WebP.
 */
export const POSTER_IMAGE_FORMATS: ImageFormat[] = ["jpeg"];

/**
 * H.264 in MP4 with AAC: not the most efficient combination, but the one every device
 * plays.
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

export const FULL_BYTES_PER_MP = 160_000;
export const POSTER_BYTES_PER_MP = 150_000;

export const THUMB_BYTES_PER_MP = 90_000;

// Never go below this, however busy the photo. Artefacts are not a saving.
export const MIN_QUALITY = 0.62;
export const MAX_QUALITY = 0.9;
export const START_QUALITY = 0.82;

export const THUMB_MAX_EDGE = 640;

// Floor for a thumbnail's budget. The default floor is bigger than its whole budget.
export const THUMB_MIN_BYTES = 6_000;

export function megapixels(width: number, height: number): number {
  return (width * height) / 1_000_000;
}

export function sizeBudget(
  width: number,
  height: number,
  bytesPerMp: number,
  floor = 30_000,
): number {
  return Math.max(floor, Math.round(megapixels(width, height) * bytesPerMp));
}
