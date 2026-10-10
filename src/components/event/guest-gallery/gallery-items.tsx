"use client";

import { GalleryEmpty } from "@/components/event/guest-gallery/gallery-empty";
import type { View } from "@/components/event/guest-gallery/use-gallery-wall";
import { PhotoGallery } from "@/components/gallery/photo-gallery";
import { cx } from "@/components/ui";
import type { GalleryLayout } from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

/**
 * How many empty frames stand in for a page on its way. Not the page size:
 * they promise that photographs are coming, not how many.
 */
const PENDING_TILES = 10;

/**
 * The photographs themselves, in the layout the host chose, or the empty well
 * when there are none.
 *
 * Each photograph is a tile from the shared gallery, same as the host's own
 * console; what is guest-specific is the heart, the tick, and the frames at the
 * end of the wall.
 */
export function GalleryItems({
  items,
  layout,
  view,
  loading,
  loadingMore,
  selecting,
  selectedCount,
  isSelected,
  isFavorite,
  onActivate,
}: {
  items: MediaView[];
  /** The event's layout, set by the host. Guests do not change it. */
  layout: GalleryLayout;
  view: View;
  loading: boolean;
  /** A page the guest asked for, which is the one that draws frames. */
  loadingMore: boolean;
  selecting: boolean;
  selectedCount: number;
  isSelected: (item: MediaView) => boolean;
  isFavorite: (item: MediaView) => boolean;
  onActivate: (item: MediaView) => void;
}) {
  if (items.length === 0 && !loading) return <GalleryEmpty view={view} />;

  return (
    <PhotoGallery
      items={items}
      layout={layout}
      onActivate={onActivate}
      isSelected={selecting ? isSelected : undefined}
      isFavorite={isFavorite}
      /* The first load draws the whole wall as frames rather than an
         empty container. */
      pending={
        loadingMore || (items.length === 0 && loading) ? PENDING_TILES : 0
      }
      className={cx("mt-6", selecting && selectedCount > 0 && "pb-20")}
    />
  );
}
