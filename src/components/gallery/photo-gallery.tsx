"use client";

import { GridLayout } from "@/components/gallery/layouts/grid";
import { HolesLayout } from "@/components/gallery/layouts/holes";
import { MasonryLayout } from "@/components/gallery/layouts/masonry";
import { StackLayout } from "@/components/gallery/layouts/stack";
import type { TileTurn } from "@/components/gallery/tile";
import { useLoadQueue } from "@/components/gallery/use-load-queue";
import type { GalleryLayout } from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

const LAYOUTS = {
  grid: GridLayout,
  masonry: MasonryLayout,
  stack: StackLayout,
  holes: HolesLayout,
} as const;

/**
 * One gallery, four shapes, used by both the guest page and the host dashboard.
 *
 * The host selects and deletes; the guest opens a lightbox. Rather than two
 * components drifting apart, the difference is one callback and an optional
 * selected set - everything about how a photo is *presented* stays in the
 * layouts, and everything about when it is allowed to load stays here.
 */
export function PhotoGallery({
  items,
  layout,
  onActivate,
  isSelected,
  pending = 0,
  className,
}: {
  items: MediaView[];
  layout: GalleryLayout;
  onActivate: (item: MediaView) => void;
  /** Host mode. Omit entirely for a read-only gallery. */
  isSelected?: (item: MediaView) => boolean;
  /**
   * Photographs asked for and not yet arrived, drawn as empty shimmering frames
   * at the end of the wall. The wall answers the tap immediately and fills in
   * behind - rather than staying exactly as it was for two seconds, which is
   * indistinguishable from a button that did not work.
   */
  pending?: number;
  className?: string;
}) {
  const { held, settle } = useLoadQueue(items);

  /** Position in `items` is what decides a photograph's turn, in every layout. */
  const turn = (item: MediaView, index: number): TileTurn => ({
    item,
    onActivate,
    selected: isSelected?.(item) ?? false,
    selectable: Boolean(isSelected),
    hold: held(index),
    onSettled: settle,
  });

  const Layout = LAYOUTS[layout] ?? GridLayout;

  return (
    <Layout
      items={items}
      turn={turn}
      pending={pending}
      className={className}
    />
  );
}
