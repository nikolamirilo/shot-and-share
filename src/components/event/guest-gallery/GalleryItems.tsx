"use client";

import { PENDING_TILES } from "@/constants/gallery";

import { GalleryEmpty } from "@/components/event/guest-gallery/GalleryEmpty";
import { type View } from "@/types/gallery";
import { PhotoGallery } from "@/components/gallery/PhotoGallery";
import { cx } from "@/components/ui";
import { type GalleryLayout } from "@/constants/gallery";
import { type MediaView } from "@/types/media";


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
  layout: GalleryLayout;
  view: View;
  loading: boolean;
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
      pending={
        loadingMore || (items.length === 0 && loading) ? PENDING_TILES : 0
      }
      className={cx("mt-6", selecting && selectedCount > 0 && "pb-20")}
    />
  );
}
