import type { MediaRow } from "@/lib/db/types";

/**
 * One photograph or clip, as everything that renders it wants to see it.
 *
 * Pure data in a pure module: client components import this, so it must not
 * live anywhere that pulls in `server-only`.
 */
export interface MediaView {
  id: string;
  kind: MediaRow["kind"];
  width: number | null;
  height: number | null;
  createdAt: string;
  /**
   * When it was taken, or when it arrived if the device did not say - the
   * order of the "time taken" sort. See migration 0024.
   */
  takenAt: string;
  uploaderFingerprint: string | null;
  sizeBytes: number;
  /**
   * What a grid shows: for a photo its stored thumbnail, falling back to the
   * full copy when there is not one, and for a video its poster frame.
   */
  previewUrl: string | null;
  /**
   * The full-size copy, for the one or two places that show a photograph
   * large: the lightbox and the Stack layout. Still through the optimiser, not
   * raw - the stored file is a couple of megabytes.
   */
  fullUrl: string | null;
  /** Poster frame for a video, so a grid never shows a grey box. */
  posterUrl: string | null;
  durationSeconds: number | null;
  /** True while the worker still owes this file a viewable copy. */
  processing: boolean;
  /**
   * The stored object behind a short-lived signature, resolved only when
   * something is opened. What a video plays from and Download points at.
   */
  url?: string;
  /**
   * The same object, signed to come back as an attachment. A browser ignores
   * `download` on a cross-origin link, so only the bucket sending
   * Content-Disposition actually saves the file.
   */
  downloadUrl?: string;
  /** Format of the stored object. */
  format: string | null;
  /**
   * Why this is not on the wall, when it is not. Absent on an approved
   * photograph, which is almost all of them, so the guest gallery's payload
   * does not grow a field it would never read.
   */
  review?: {
    state: "held" | "reported";
    /** Category names from the automated check. Empty when a person reported it. */
    labels: string[];
    /** How many guests pressed report. Zero unless somebody did. */
    reports: number;
  };
}

/**
 * How many photographs a page holds. Fifty is five waves of ten - see
 * useLoadQueue. Here rather than in a server module because the guest gallery
 * pages on the client and shares the number with the route that serves it.
 */
export const GALLERY_PAGE_SIZE = 50;

/** The two orders a gallery can be in. */
export const GALLERY_SORTS = [
  { id: "added", name: "Last added" },
  { id: "taken", name: "Time taken" },
] as const;

export type GallerySort = (typeof GALLERY_SORTS)[number]["id"];

export const DEFAULT_SORT: GallerySort = "added";

export function coerceSort(value: unknown): GallerySort {
  return value === "taken" ? "taken" : DEFAULT_SORT;
}

/**
 * The cursor for the "time taken" order: the timestamp and the id together,
 * because a burst of shots shares its second and a cursor on the timestamp
 * alone would skip the rest of the burst at a page boundary.
 */
export function takenCursor(item: { takenAt: string; id: string }): string {
  return `${item.takenAt}|${item.id}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The other way, or null for anything that is not exactly a timestamp and a
 * uuid. The result is spliced into a PostgREST filter, so nothing else passes.
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

/** Where the next page starts, for whichever order the wall is in. */
export function cursorOf(item: MediaView, sort: GallerySort): string {
  return sort === "taken" ? takenCursor(item) : item.createdAt;
}
