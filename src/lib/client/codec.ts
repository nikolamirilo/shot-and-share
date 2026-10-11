"use client";

import {
  FULL_BYTES_PER_MP,
  FULL_IMAGE_FORMAT,
  type ImageFormat,
  IMAGE_MIME,
  MAX_QUALITY,
  MIN_QUALITY,
  POSTER_BYTES_PER_MP,
  POSTER_IMAGE_FORMATS,
  START_QUALITY,
  THUMB_BYTES_PER_MP,
  THUMB_IMAGE_FORMATS,
  THUMB_MAX_EDGE,
  THUMB_MIN_BYTES,
  sizeBudget,
} from "@/lib/media/formats";
import { POSTER_MAX_EDGE } from "@/lib/media";

const probeCache = new Map<string, Promise<boolean>>();

/**
 * Inspects `blob.type`, not just whether a blob came back: `canvas.toBlob` silently
 * falls back to PNG for a type it does not support.
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

export async function bestEncodableFormat(
  order: ImageFormat[] = THUMB_IMAGE_FORMATS,
): Promise<ImageFormat> {
  for (const format of order) {
    if (await canEncode(format)) return format;
  }
  // JPEG encoding is required by the HTML specification, so this is a floor.
  return "jpeg";
}

export function resetProbeCache() {
  probeCache.clear();
}

export interface Encoded {
  blob: Blob;
  format: ImageFormat;
  width: number;
  height: number;
  quality: number;
}

function draw(
  bitmap: ImageBitmap,
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

    // A probe can pass and an individual encode still return the PNG fallback.
    if (blob.type !== mime) return null;

    best = { blob, quality };
    if (blob.size <= budget) {
      if (blob.size < budget * 0.6 && quality < MAX_QUALITY) {
        quality = Math.min(MAX_QUALITY, quality + 0.06);
        continue;
      }
      break;
    }

    if (quality <= MIN_QUALITY) break;
    const overshoot = Math.min(0.14, (blob.size / budget - 1) * 0.12);
    quality = Math.max(MIN_QUALITY, quality - Math.max(0.05, overshoot));
  }

  return best;
}

export interface Compression {
  full: Encoded | null;
  thumb: Encoded | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  needsServer: boolean;
}

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
    // Chiefly HEIC outside Safari. The original uploads and the worker converts it.
    return empty;
  }

  onProgress?.(0.25);

  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;

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

    if (!full) return { ...empty, sourceWidth, sourceHeight };

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
    }
    return empty;
  }
}

export interface VideoProbe {
  poster: Encoded | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  needsServer: boolean;
}

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

    // A tenth of the way in: the first frame of a phone video is often a blur.
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

    const format = await bestEncodableFormat(POSTER_IMAGE_FORMATS);
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
