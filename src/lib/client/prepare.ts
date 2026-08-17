"use client";

import { compressImage, probeVideo } from "@/lib/client/codec";

/**
 * What the browser can do for a file before it leaves the device, and what it
 * expects that to cost.
 *
 * Pure functions with no React in them. They lived inside the uploader
 * component, which is why nothing tested them - a batch-size estimate is
 * exactly the kind of arithmetic that should be checkable without rendering a
 * page.
 */

/** Everything the browser managed to produce for one selected file. */
export interface Prepared {
  /** The full-size copy. Still called `compressed` because it is re-encoded. */
  compressed: Blob | null;
  thumb: Blob | null;
  poster: Blob | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  descriptor: Record<string, unknown>;
}

/**
 * What a photo is expected to shrink to, used only to fail fast.
 *
 * A guest who picks two gigabytes into an event with two hundred megabytes left
 * should hear about it in the half second after tapping, not after thirty
 * seconds of compressing. It is deliberately optimistic - because the cost of
 * being wrong in this direction is one wasted upload attempt, and the cost of
 * being wrong in the other is refusing a batch that would have fitted.
 *
 * Halved, not quartered, since the full copy stopped being downscaled.
 */
const OPTIMISTIC_COMPRESSION = 2;

/**
 * The smallest these files could plausibly become, for the fail-fast check.
 * Video is counted whole: the browser cannot compress it, and pretending
 * otherwise would let a batch through that has no chance of fitting.
 */
export function estimate(files: File[]): number {
  return files.reduce(
    (sum, file) =>
      sum +
      (file.type.startsWith("video/")
        ? file.size
        : file.size / OPTIMISTIC_COMPRESSION),
    0,
  );
}

/**
 * Everything the browser can do for one file before it leaves the device:
 * decode it, shrink it, re-encode it into a format that opens anywhere, and -
 * for a video - pull a poster frame out of it.
 */
export async function prepare(
  file: File,
  /**
   * Roughly how far through the encoding this file is, 0 to 1. Coarse - there
   * is no way to see inside `toBlob` - but enough that the bar moves while a
   * phone is working rather than sitting at zero looking stuck.
   */
  onProgress?: (fraction: number) => void,
): Promise<Prepared> {
  if (file.type.startsWith("video/")) {
    const probe = await probeVideo(file, onProgress);
    onProgress?.(1);
    return {
      compressed: null,
      // A clip's poster frame is already its small copy.
      thumb: null,
      poster: probe.poster?.blob ?? null,
      sourceWidth: probe.width,
      sourceHeight: probe.height,
      descriptor: {
        size: file.size,
        type: file.type,
        poster: probe.poster
          ? {
              size: probe.poster.blob.size,
              format: probe.poster.format,
              width: probe.poster.width,
              height: probe.poster.height,
            }
          : null,
        sourceWidth: probe.width,
        sourceHeight: probe.height,
        durationSeconds: probe.durationSeconds,
        needsServer: true,
      },
    };
  }

  const result = await compressImage(file, onProgress);
  onProgress?.(1);
  return {
    compressed: result.full?.blob ?? null,
    thumb: result.thumb?.blob ?? null,
    poster: null,
    sourceWidth: result.sourceWidth,
    sourceHeight: result.sourceHeight,
    descriptor: {
      size: file.size,
      type: file.type,
      compressed: result.full
        ? {
            size: result.full.blob.size,
            format: result.full.format,
            width: result.full.width,
            height: result.full.height,
          }
        : null,
      thumb: result.thumb
        ? {
            size: result.thumb.blob.size,
            format: result.thumb.format,
            width: result.thumb.width,
            height: result.thumb.height,
          }
        : null,
      sourceWidth: result.sourceWidth,
      sourceHeight: result.sourceHeight,
      needsServer: result.needsServer,
    },
  };
}
