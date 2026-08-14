/**
 * Gallery layouts. The host chooses one and every guest gets it - it is part of
 * the custom event page, like the theme and the cover, so the guest page has no
 * switcher. The host's own console keeps one, stored in their browser, because
 * there they are managing photographs rather than looking at an event page.
 */

import type { MediaView } from "@/lib/media-view";

export const GALLERY_LAYOUTS = [
  {
    id: "grid",
    name: "Grid",
    /** Shown to the host when picking. */
    hint: "Every photo the same size, cropped to a square. Easiest to scan.",
  },
  {
    id: "masonry",
    name: "Masonry",
    hint: "Nothing cropped. Tall and wide photos keep their real shape.",
  },
  {
    id: "holes",
    name: "Circles",
    hint: "Circles at varied sizes, cut out of the page. Ours.",
  },
  {
    id: "stack",
    name: "Stack",
    hint: "One photo at a time, full width. Slow scrolling, big pictures.",
  },
] as const;

export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number]["id"];

export const DEFAULT_LAYOUT: GalleryLayout = "grid";

const IDS = GALLERY_LAYOUTS.map((l) => l.id) as readonly string[];

export function isGalleryLayout(value: unknown): value is GalleryLayout {
  return typeof value === "string" && IDS.includes(value);
}

export function coerceLayout(value: unknown): GalleryLayout {
  return isGalleryLayout(value) ? value : DEFAULT_LAYOUT;
}

/**
 * The Circles layout cycles through these diameters rather than randomising, so
 * a photo does not change size when the gallery re-renders or a new upload
 * lands. The sequence is uneven on purpose - evenly varied reads as a mistake.
 */
export const HOLE_SIZES = [148, 96, 188, 120, 84, 164, 108, 132] as const;

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

/**
 * The photos either side of the open one, so the lightbox can point its arrows
 * somewhere or grey them out.
 *
 * It works on the loaded list, not the whole event, so `next: null` means "no
 * further without asking" rather than "last photo of the night".
 *
 * A missing id gives up in both directions: that is what happens when a guest
 * deletes their own photo while it is the one on screen.
 */
export function neighbours(
  ids: readonly string[],
  currentId: string,
): { prev: string | null; next: string | null } {
  const at = ids.indexOf(currentId);
  if (at === -1) return { prev: null, next: null };
  return {
    prev: ids[at - 1] ?? null,
    next: ids[at + 1] ?? null,
  };
}

/* --- keeping a wall up to date -------------------------------------------- */

/**
 * A fresh newest-first page, keeping anything older the guest had scrolled to.
 *
 * The page is authoritative for the stretch it covers - a photo deleted inside
 * that range is gone, one that arrived appears - and everything older is kept
 * as it was. An empty page means an empty gallery, not a failed request; those
 * throw before they reach here.
 */
export function withFreshHead(
  held: readonly MediaView[],
  head: readonly MediaView[],
): MediaView[] {
  if (head.length === 0) return [];
  const oldest = head[head.length - 1].createdAt;
  const arrived = new Set(head.map((item) => item.id));
  const older = held.filter(
    (item) => item.createdAt < oldest && !arrived.has(item.id),
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

const STORAGE_KEY = "shot-and-share:gallery-layout";

/**
 * The host's own preference in their console, if they have expressed one.
 * Guest pages do not read or write it - they render the event's layout.
 */
export function readViewerLayout(): GalleryLayout | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isGalleryLayout(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeViewerLayout(layout: GalleryLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // Private mode. The choice simply does not persist.
  }
}
