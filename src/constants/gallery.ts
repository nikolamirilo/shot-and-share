/** How many photographs one gallery request returns. */
export const GALLERY_PAGE_SIZE = 50;

/** Newest arrivals, or the evening in the order it happened. */
export const GALLERY_SORTS = [
  { id: "added", name: "Last added" },
  { id: "taken", name: "Time taken" },
] as const;

/** Defined beside the list it comes from, so the two cannot drift. */
export type GallerySort = (typeof GALLERY_SORTS)[number]["id"];

export const DEFAULT_SORT: GallerySort = "added";

/** How often the guest wall may ask what is new. */
export const GALLERY_REFRESH_MS = 3000;

/** How many favourites one gallery request takes. The rest go in the next. */
export const FAVORITE_IDS_PER_REQUEST = 100;

/** How many photographs one ZIP download request asks for. */
export const DOWNLOAD_BATCH = 100;

/** How many frames a loading wall draws before the first page lands. */
export const PENDING_TILES = 10;

/** How far ahead of the lightbox the next photographs are fetched. */
export const PRELOAD_AHEAD = 20;

/** How many photographs a loading wall asks the browser to decode at once. */
export const LOAD_WAVE = 10;

/** How long a wave waits before giving up and letting the next one start. */
export const WAVE_TIMEOUT_MS = 6000;

/** The gallery shapes a host can pick from. */
export const GALLERY_LAYOUTS = [
  {
    id: "grid",
    name: "Grid",
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

/** Defined beside the list it comes from, so the two cannot drift. */
export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number]["id"];

export const DEFAULT_LAYOUT: GalleryLayout = "grid";

/** The repeating circle sizes of the Circles layout. */
export const HOLE_SIZES = [148, 96, 188, 120, 84, 164, 108, 132] as const;
