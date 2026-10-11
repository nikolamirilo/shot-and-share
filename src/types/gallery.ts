/** Photos and videos are separate walls; favourites is the guest's own list. */
export type View = "photo" | "video" | "favorites";

/** How many of each a guest can see, for the tab labels. */
export type GalleryCounts = {
  photo: number | null;
  video: number | null;
};
