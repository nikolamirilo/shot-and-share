"use client";

/**
 * When a photo or clip was taken, read on the guest's device.
 *
 * It has to happen here and before compression: the browser re-encodes every
 * photo, and the re-encode carries no metadata, so by the time the bytes reach
 * the bucket the date is gone.
 *
 * EXIF first - DateTimeOriginal is the shutter, CreateDate the next best - and
 * the file's modified time when there is none. A video has no EXIF, and a phone
 * sets a clip's modified time when it finishes recording, which is near enough
 * to order a wall by. Every failure is null; the date only ever orders the
 * gallery, so it is not worth an upload.
 */
export async function readTakenAt(file: File): Promise<string | null> {
  if (!file.type.startsWith("video/")) {
    try {
      // Loaded on the first upload rather than with the page.
      const { default: exifr } = await import("exifr");
      const tags = (await exifr.parse(file, {
        pick: ["DateTimeOriginal", "CreateDate"],
      })) as { DateTimeOriginal?: unknown; CreateDate?: unknown } | undefined;
      const found = asIso(tags?.DateTimeOriginal) ?? asIso(tags?.CreateDate);
      if (found) return found;
    } catch {
      // Not a format exifr reads, or no metadata at all. Fall through.
    }
  }
  return file.lastModified ? asIso(new Date(file.lastModified)) : null;
}

function asIso(value: unknown): string | null {
  if (!(value instanceof Date)) return null;
  const at = value.getTime();
  return Number.isFinite(at) ? value.toISOString() : null;
}
