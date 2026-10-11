import {
  DEFAULT_LAYOUT,
  GALLERY_LAYOUTS,
  type GalleryLayout,
  type GallerySort,
  HOLE_SIZES,
  PRELOAD_AHEAD,
} from "@/constants/gallery";
import type { MediaView } from "@/types/media";

const IDS = GALLERY_LAYOUTS.map((l) => l.id) as readonly string[];

export function isGalleryLayout(value: unknown): value is GalleryLayout {
  return typeof value === "string" && IDS.includes(value);
}

export function coerceLayout(value: unknown): GalleryLayout {
  return isGalleryLayout(value) ? value : DEFAULT_LAYOUT;
}

export function holeSize(index: number): number {
  return HOLE_SIZES[index % HOLE_SIZES.length];
}

/** Falls back to a square when a thumbnail never generated, so nothing jumps. */
export function aspectRatio(
  width: number | null,
  height: number | null,
): number {
  if (!width || !height || width <= 0 || height <= 0) return 1;
  // Clamp so one absurd panorama cannot make a masonry column a mile long.
  return Math.min(2.5, Math.max(0.4, width / height));
}

export function neighbours<T extends { id: string }>(
  items: readonly T[],
  currentId: string,
): { prev: T | null; next: T | null } {
  const at = items.findIndex((item) => item.id === currentId);
  if (at === -1) return { prev: null, next: null };
  return {
    prev: items[at - 1] ?? null,
    next: items[at + 1] ?? null,
  };
}

export function upcoming(
  items: readonly MediaView[],
  currentId: string,
): MediaView[] {
  const at = items.findIndex((item) => item.id === currentId);
  if (at === -1) return [];
  return items
    .slice(at + 1, at + 1 + PRELOAD_AHEAD)
    .filter((item) => item.kind !== "video");
}

export function withFreshHead(
  held: readonly MediaView[],
  head: readonly MediaView[],
  sort: GallerySort = "added",
): MediaView[] {
  if (head.length === 0) return [];
  const at = (item: MediaView) =>
    sort === "taken" ? item.takenAt : item.createdAt;
  const oldest = at(head[head.length - 1]);
  const arrived = new Set(head.map((item) => item.id));
  const older = held.filter(
    (item) => at(item) < oldest && !arrived.has(item.id),
  );
  return [...head, ...older];
}

/** "Show more": another page onto the end, minus anything already held. */
export function withOlder(
  held: readonly MediaView[],
  page: readonly MediaView[],
): MediaView[] {
  const seen = new Set(held.map((item) => item.id));
  return [...held, ...page.filter((item) => !seen.has(item.id))];
}
