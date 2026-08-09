/**
 * Gallery layouts.
 *
 * The **host** chooses one, and that is the one every guest gets. The layout is
 * part of what the paid tiers call the custom event page - it is a decision
 * about how the event looks, in the same way the theme and the cover are - so
 * the guest page has no switcher on it at all. A wall that every guest sees the
 * same way is also the wall the host is actually designing.
 *
 * The host's own console keeps a switcher, because there they are managing
 * photographs rather than looking at an event page; that preference lives in
 * their browser and never touches the event.
 */

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
    name: "Holes",
    hint: "Circles at varied sizes, punched through the page. Ours.",
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
 * The Holes layout cycles through these diameters rather than randomising, so
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

const STORAGE_KEY = "say-cheese:gallery-layout";

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
