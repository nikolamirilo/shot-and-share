"use client";

import { compressImage, probeVideo } from "@/lib/client/codec";
import { readTakenAt } from "@/lib/client/taken-at";

export interface Prepared {
  compressed: Blob | null;
  thumb: Blob | null;
  poster: Blob | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  descriptor: Record<string, unknown>;
}

const OPTIMISTIC_COMPRESSION = 2;

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

export async function prepare(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<Prepared> {
  const takenAt = readTakenAt(file);

  if (file.type.startsWith("video/")) {
    const probe = await probeVideo(file, onProgress);
    onProgress?.(1);
    return {
      compressed: null,
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
        takenAt: await takenAt,
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
      takenAt: await takenAt,
      needsServer: result.needsServer,
    },
  };
}
