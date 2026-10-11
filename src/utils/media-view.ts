import { DEFAULT_SORT, type GallerySort } from "@/constants/gallery";
import type { MediaView } from "@/types/media";

export function coerceSort(value: unknown): GallerySort {
  return value === "taken" ? "taken" : DEFAULT_SORT;
}

export function takenCursor(item: { takenAt: string; id: string }): string {
  return `${item.takenAt}|${item.id}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Null for anything that is not exactly a timestamp and a uuid: the result is spliced
 * into a PostgREST filter.
 */
export function parseTakenCursor(
  cursor: string,
): { at: string; id: string } | null {
  const [at, id, ...rest] = cursor.split("|");
  if (rest.length > 0 || !at || !id || !UUID.test(id)) return null;
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return null;
  return { at: new Date(time).toISOString(), id };
}

export function cursorOf(item: MediaView, sort: GallerySort): string {
  return sort === "taken" ? takenCursor(item) : item.createdAt;
}
