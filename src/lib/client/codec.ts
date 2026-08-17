"use client";

import {
  FULL_BYTES_PER_MP,
  FULL_IMAGE_FORMAT,
  type ImageFormat,
  IMAGE_MIME,
  MAX_QUALITY,
  MIN_QUALITY,
  POSTER_BYTES_PER_MP,
  START_QUALITY,
  THUMB_BYTES_PER_MP,
  THUMB_IMAGE_FORMATS,
  THUMB_MAX_EDGE,
  THUMB_MIN_BYTES,
  sizeBudget,
} from "@/lib/media/formats";
import { POSTER_MAX_EDGE } from "@/lib/media";

/**
 * Compression, on the device that took the photo. The phone already has the
 * pixels decoded and spare cycles while the guest looks at the screen, and a
 * 4 MB photo becomes a 900 KB upload - on venue wifi that is the difference
 * between a guest finishing and a guest giving up.
 */

/* --- capability probing ---------------------------------------------------- */

const probeCache = new Map<string, Promise<boolean>>();

/**
 * Whether this browser can *encode* a format. The check inspects `blob.type`,
 * not just whether a blob came back: `canvas.toBlob` silently falls back to PNG
 * for a type it does not support, so a naive check succeeds everywhere and
 * ships PNG bytes labelled as WebP.
 */
export function canEncode(format: ImageFormat): Promise<boolean> {
  const mime = IMAGE_MIME[format];
  const cached = probeCache.get(mime);
  if (cached) return cached;

  const probe = (async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, 0.8),
      );
      return Boolean(blob) && blob!.type === mime;
    } catch {
      return false;
    }
  })();

  probeCache.set(mime, probe);
  return probe;
}

/** The best format this browser can produce, from a preference order. */
export async function bestEncodableFormat(
  order: ImageFormat[] = THUMB_IMAGE_FORMATS,
): Promise<ImageFormat> {
  for (const format of order) {
    if (await canEncode(format)) return format;
  }
  // JPEG encoding is required by the HTML specification, so this is the floor
  // rather than a hope.
  return "jpeg";
}

export function resetProbeCache() {
  probeCache.clear();
}

/* --- encoding -------------------------------------------------------------- */

export interface Encoded {
  blob: Blob;
  format: ImageFormat;
  width: number;
  height: number;
  quality: number;
}

function draw(
  bitmap: ImageBitmap,
  /** Infinity keeps every pixel, which is what the full-size copy wants. */
  maxEdge: number = Number.POSITIVE_INFINITY,
): { canvas: HTMLCanvasElement; width: number; height: number } | null {
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, maxEdge / longest);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, width, height };
}

function toBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/**
 * Encode towards a size budget rather than a fixed quality.
 *
 * Three attempts, walking quality up or down. Bounded on purpose: this runs on
 * a phone with a queue of photos behind it, and the difference between the
 * third and the fifth attempt is invisible.
 */
async function encodeToBudget(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  width: number,
  height: number,
  bytesPerMp: number,
  floor?: number,
): Promise<{ blob: Blob; quality: number } | null> {
  const mime = IMAGE_MIME[format];
  const budget = sizeBudget(width, height, bytesPerMp, floor);

  let quality = START_QUALITY;
  let best: { blob: Blob; quality: number } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const blob = await toBlob(canvas, mime, quality);
    if (!blob) break;

    // Guard against the silent PNG fallback even here: a probe can pass and an
    // individual encode still return something else.
    if (blob.type !== mime) return null;

    best = { blob, quality };
    if (blob.size <= budget) {
      // Comfortably under: spend some of the headroom on quality instead.
      if (blob.size < budget * 0.6 && quality < MAX_QUALITY) {
        quality = Math.min(MAX_QUALITY, quality + 0.06);
        continue;
      }
      break;
    }

    if (quality <= MIN_QUALITY) break;
    // Overshoot scaled to how far over budget we are.
    const overshoot = Math.min(0.14, (blob.size / budget - 1) * 0.12);
    quality = Math.max(MIN_QUALITY, quality - Math.max(0.05, overshoot));
  }

  return best;
}

export interface Compression {
  /**
   * Every pixel the camera captured, as a JPEG. This is what a host downloads,
   * prints from and gets in the ZIP. Null when the browser could not decode
   * the file, in which case the source goes up untouched and the worker
   * produces both copies server-side.
   */
  full: Encoded | null;
  /**
   * The small copy the gallery grid loads. Null whenever the full copy is, and
   * independently null if only the thumbnail encode failed - a photo without
   * one still works, it just falls back to the full copy in the grid.
   */
  thumb: Encoded | null;
  /** True pixel dimensions of the source, whatever we managed to encode. */
  sourceWidth: number | null;
  sourceHeight: number | null;
  /** The browser could not read this file; a server pass is needed. */
  needsServer: boolean;
}

/**
 * Roughly how far through the encoding we are, 0 to 1.
 *
 * Coarse on purpose: there are three real checkpoints - decoded, full copy
 * encoded, thumbnail encoded - and no way to see inside `toBlob`. Three steps
 * is still enough that the bar moves while a phone is working, which is the
 * whole point. Without it the bar sits at zero through the slowest part of the
 * wait and reads as stuck.
 */
export type OnEncodeProgress = (fraction: number) => void;

export async function compressImage(
  file: File,
  onProgress?: OnEncodeProgress,
): Promise<Compression> {
  const empty: Compression = {
    full: null,
    thumb: null,
    sourceWidth: null,
    sourceHeight: null,
    needsServer: true,
  };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Chiefly HEIC outside Safari. The original still uploads and the worker
    // converts it, so the guest never sees a failure.
    return empty;
  }

  // Decoding a 48MP photo is a real part of the wait, so it is worth saying so.
  onProgress?.(0.25);

  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;

    /*
     * Both surfaces are drawn before the bitmap is closed. Closing it after the
     * first draw - which is what this did when there was only one copy - leaves
     * the second with nothing to read.
     */
    const fullSurface = draw(bitmap);
    const thumbSurface = draw(bitmap, THUMB_MAX_EDGE);
    bitmap.close();

    if (!fullSurface) return { ...empty, sourceWidth, sourceHeight };

    const full = await encodeToBudget(
      fullSurface.canvas,
      FULL_IMAGE_FORMAT,
      fullSurface.width,
      fullSurface.height,
      FULL_BYTES_PER_MP,
    );

    // An encode that came back empty is not a photo, so the source has to go up
    // and the worker has to finish the job.
    if (!full) return { ...empty, sourceWidth, sourceHeight };

    // The expensive one is behind us: the thumbnail is a fraction of the pixels.
    onProgress?.(0.85);

    const thumbFormat = await bestEncodableFormat(THUMB_IMAGE_FORMATS);
    const thumb = thumbSurface
      ? await encodeToBudget(
          thumbSurface.canvas,
          thumbFormat,
          thumbSurface.width,
          thumbSurface.height,
          THUMB_BYTES_PER_MP,
          THUMB_MIN_BYTES,
        )
      : null;

    return {
      full: {
        blob: full.blob,
        format: FULL_IMAGE_FORMAT,
        width: fullSurface.width,
        height: fullSurface.height,
        quality: full.quality,
      },
      // Deliberately not fatal. The grid falls back to the full copy through
      // the optimiser, which is exactly what an older row does.
      thumb:
        thumb && thumbSurface
          ? {
              blob: thumb.blob,
              format: thumbFormat,
              width: thumbSurface.width,
              height: thumbSurface.height,
              quality: thumb.quality,
            }
          : null,
      sourceWidth,
      sourceHeight,
      needsServer: false,
    };
  } catch {
    try {
      bitmap.close();
    } catch {
      /* already closed */
    }
    return empty;
  }
}

/* --- video ----------------------------------------------------------------- */

export interface VideoProbe {
  poster: Encoded | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  needsServer: boolean;
}

/**
 * Pull a poster frame and the real dimensions out of a video, in the browser.
 *
 * Transcoding the video itself is deliberately *not* attempted here. The only
 * client-side route is MediaRecorder, which re-encodes in real time - a
 * two-minute clip takes two minutes, with the guest watching a spinner at a
 * party. That is worse than useless. Video compression belongs in the worker;
 * see workers/transcode. What the browser can usefully do is this: a poster
 * frame in a few hundred milliseconds, so the gallery has something to show
 * immediately instead of a grey box.
 */
export async function probeVideo(
  file: File,
  onProgress?: OnEncodeProgress,
): Promise<VideoProbe> {
  const empty: VideoProbe = {
    poster: null,
    width: null,
    height: null,
    durationSeconds: null,
    needsServer: true,
  };

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  // Required for drawImage to produce a readable canvas from some sources.
  video.crossOrigin = "anonymous";

  try {
    const metadata = await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => resolve(ok);
      video.onloadedmetadata = () => done(true);
      video.onerror = () => done(false);
      // A codec the browser cannot open should not hang the upload queue.
      setTimeout(() => done(false), 5000);
      video.src = url;
    });

    if (!metadata || !video.videoWidth) return empty;

    onProgress?.(0.4);

    const width = video.videoWidth;
    const height = video.videoHeight;
    const durationSeconds = Number.isFinite(video.duration)
      ? video.duration
      : null;

    // A tenth of the way in: the first frame of a phone video is very often a
    // blur or a lens cap, and one second in is usually the actual scene.
    const seekTo = Math.min(
      durationSeconds ? durationSeconds * 0.1 : 1,
      durationSeconds ? Math.max(0, durationSeconds - 0.1) : 1,
    );

    const seeked = await new Promise<boolean>((resolve) => {
      video.onseeked = () => resolve(true);
      video.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 5000);
      video.currentTime = seekTo;
    });

    if (!seeked) {
      return { ...empty, width, height, durationSeconds };
    }

    onProgress?.(0.75);

    const format = await bestEncodableFormat(THUMB_IMAGE_FORMATS);
    const longest = Math.max(width, height);
    const scale = Math.min(1, POSTER_MAX_EDGE / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return { ...empty, width, height, durationSeconds };
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const encoded = await encodeToBudget(
      canvas,
      format,
      canvas.width,
      canvas.height,
      POSTER_BYTES_PER_MP,
    );

    return {
      poster: encoded
        ? {
            blob: encoded.blob,
            format,
            width: canvas.width,
            height: canvas.height,
            quality: encoded.quality,
          }
        : null,
      width,
      height,
      durationSeconds,
      // The clip itself still has to be transcoded to something universal.
      needsServer: true,
    };
  } catch {
    return empty;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
