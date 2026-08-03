"use client";

import { THUMB_MAX_EDGE, THUMB_QUALITY } from "@/lib/media";
import type { PresignedUpload } from "@/lib/storage/types";

/**
 * Client-side upload helpers.
 *
 * The browser does the image work. A canvas resize before upload costs nothing,
 * removes an entire asynchronous pipeline from the system, and the phone that
 * took the photo is the machine best placed to do it.
 */

const FINGERPRINT_KEY = "say-cheese:fingerprint";
const NAME_KEY = "say-cheese:name";

/**
 * Not an account, and deliberately not one. A random id in localStorage is
 * exactly enough to let a guest remove the blurry photo they just uploaded,
 * and nothing more.
 */
export function getFingerprint(): string {
  try {
    const existing = localStorage.getItem(FINGERPRINT_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(FINGERPRINT_KEY, fresh);
    return fresh;
  } catch {
    // Private mode, or storage disabled. Uploads still work; only the
    // remove-my-own-photo affordance is lost.
    return crypto.randomUUID().replace(/-/g, "");
  }
}

export function getSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    if (name) localStorage.setItem(NAME_KEY, name);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    /* ignore */
  }
}

export function markOpened(eventId: string): boolean {
  try {
    const key = `say-cheese:opened:${eventId}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return false;
  }
}

export interface Thumbnail {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Returns null when the browser cannot decode the file — HEIC in some contexts,
 * video in all of them. That is not an upload failure: the original still goes
 * up, and the gallery falls back. A Lambda on object-create is the place to
 * generate the missing thumbnails once real upload data shows which formats
 * actually fail.
 */
export async function makeThumbnail(file: File): Promise<Thumbnail | null> {
  if (!file.type.startsWith("image/")) return null;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, THUMB_MAX_EDGE / longest);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    const source = { width: bitmap.width, height: bitmap.height };
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", THUMB_QUALITY),
    );
    if (!blob) return null;

    return { blob, width: source.width, height: source.height };
  } catch {
    return null;
  }
}

/**
 * Uploads straight to storage. Files never pass through the application server,
 * which is what keeps the app on a free hosting tier no matter how many photos
 * move through it.
 */
export function uploadToPresigned(
  presigned: PresignedUpload,
  body: Blob,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(presigned.fields)) {
      form.append(key, value);
    }
    // S3 requires the file field last; everything before it is policy.
    form.append(presigned.fileField, body);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", presigned.url, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload rejected (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network dropped mid-upload."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.send(form);
  });
}

/** Small worker pool: a phone on venue wifi does not want ten parallel PUTs. */
export async function pool<T>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}
