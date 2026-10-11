"use client";

import { GridLayout } from "@/components/gallery/layouts/Grid";
import { HolesLayout } from "@/components/gallery/layouts/Holes";
import { MasonryLayout } from "@/components/gallery/layouts/Masonry";
import { StackLayout } from "@/components/gallery/layouts/Stack";
import type { TileTurn } from "@/components/gallery/Tile";
import { useLoadQueue } from "@/hooks/gallery/useLoadQueue";
import { type GalleryLayout } from "@/constants/gallery";
import { type MediaView } from "@/types/media";

const LAYOUTS = {
  grid: GridLayout,
  masonry: MasonryLayout,
  stack: StackLayout,
  holes: HolesLayout,
} as const;

export function PhotoGallery({
  items,
  layout,
  onActivate,
  isSelected,
  isFavorite,
  pending = 0,
  className,
}: {
  items: MediaView[];
  layout: GalleryLayout;
  onActivate: (item: MediaView) => void;
  isSelected?: (item: MediaView) => boolean;
  isFavorite?: (item: MediaView) => boolean;
  pending?: number;
  className?: string;
}) {
  const { held, settle } = useLoadQueue(items);

  const turn = (item: MediaView, index: number): TileTurn => ({
    item,
    onActivate,
    selected: isSelected?.(item) ?? false,
    selectable: Boolean(isSelected),
    hold: held(index),
    onSettled: settle,
    favorite: isFavorite?.(item) ?? false,
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
