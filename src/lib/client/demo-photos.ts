"use client";

/**
 * The photos a visitor adds on /demo, kept in their own browser.
 *
 * There is no event behind that page, so nothing is presigned and nothing
 * reaches S3: a picked file is shrunk to a data URL and written to local
 * storage, which is also all that survives a reload.
 *
 * Local storage holds roughly 5MB an origin and a data URL costs a third more
 * than the bytes it carries, so photos are shrunk hard, the set is capped, and
 * the oldest make way when a new one does not fit.
 */

import { DEMO_PHOTOS_KEY } from "@/constants/storage-keys";
import type { MediaView } from "@/types/media";

export const MAX_DEMO_PHOTOS = 12;

/** Characters of JSON, not bytes of image: see the note above. */
const TOTAL_BUDGET = 3_500_000;
const PER_PHOTO_BUDGET = 420_000;

const MAX_EDGE = 1280;
const QUALITIES = [0.72, 0.6, 0.46];

export interface DemoPhoto {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

/**
 * One picked file as a small JPEG data URL, or null when the browser cannot
 * decode it - chiefly HEIC outside Safari, which only the server can read.
 */
export async function shrinkForDemo(file: File): Promise<DemoPhoto | null> {
  if (!file.type.startsWith("image/")) return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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

    let dataUrl = "";
    for (const quality of QUALITIES) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= PER_PHOTO_BUDGET) break;
    }
    if (!dataUrl.startsWith("data:image/jpeg")) return null;

    return {
      id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      dataUrl,
      width,
      height,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

export function readDemoPhotos(): DemoPhoto[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(DEMO_PHOTOS_KEY) ?? "[]",
    );
    return Array.isArray(parsed) ? parsed.filter(isDemoPhoto) : [];
  } catch {
    return [];
  }
}

/** Writes what fits, newest first, and returns it - which may be fewer. */
export function writeDemoPhotos(photos: DemoPhoto[]): DemoPhoto[] {
  let kept = photos.slice(0, MAX_DEMO_PHOTOS);

  while (kept.length > 0) {
    const json = JSON.stringify(kept);
    if (json.length <= TOTAL_BUDGET) {
      try {
        localStorage.setItem(DEMO_PHOTOS_KEY, json);
        return kept;
      } catch {
        // Quota, private mode or a full disk. Drop the oldest and try again.
      }
    }
    kept = kept.slice(0, -1);
  }

  clearDemoPhotos();
  return [];
}

export function clearDemoPhotos() {
  try {
    localStorage.removeItem(DEMO_PHOTOS_KEY);
  } catch {
    // Nothing to undo: the page already holds the list it is showing.
  }
}

export function toMediaView(photo: DemoPhoto): MediaView {
  return {
    id: photo.id,
    kind: "photo",
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
    takenAt: photo.createdAt,
    uploaderFingerprint: null,
    sizeBytes: Math.round((photo.dataUrl.length * 3) / 4),
    previewUrl: photo.dataUrl,
    fullUrl: photo.dataUrl,
    posterUrl: null,
    durationSeconds: null,
    processing: false,
    format: "jpeg",
  };
}

function isDemoPhoto(value: unknown): value is DemoPhoto {
  if (typeof value !== "object" || value === null) return false;
  const photo = value as Record<string, unknown>;
  return (
    typeof photo.id === "string" &&
    typeof photo.dataUrl === "string" &&
    photo.dataUrl.startsWith("data:image/") &&
    typeof photo.width === "number" &&
    typeof photo.height === "number" &&
    typeof photo.createdAt === "string"
  );
}
