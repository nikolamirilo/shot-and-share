"use client";

export async function readTakenAt(file: File): Promise<string | null> {
  if (!file.type.startsWith("video/")) {
    try {
      const { default: exifr } = await import("exifr");
      const tags = (await exifr.parse(file, {
        pick: ["DateTimeOriginal", "CreateDate"],
      })) as { DateTimeOriginal?: unknown; CreateDate?: unknown } | undefined;
      const found = asIso(tags?.DateTimeOriginal) ?? asIso(tags?.CreateDate);
      if (found) return found;
    } catch {
    }
  }
  return file.lastModified ? asIso(new Date(file.lastModified)) : null;
}

function asIso(value: unknown): string | null {
  if (!(value instanceof Date)) return null;
  const at = value.getTime();
  return Number.isFinite(at) ? value.toISOString() : null;
}
