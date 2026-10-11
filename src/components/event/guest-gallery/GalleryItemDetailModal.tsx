"use client";

import { Lightbox } from "@/components/gallery/Lightbox";
import { neighbours, upcoming } from "@/utils/gallery";
import { type MediaView } from "@/types/media";

export function GalleryItemDetailModal({
  token,
  items,
  openId,
  favoriteIds,
  onToggleFavorite,
  onStep,
  onClose,
  onReported,
}: {
  token: string;
  items: MediaView[];
  openId: string | null;
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  onStep: (id: string) => void;
  onClose: () => void;
  onReported: (id: string) => void;
}) {
  const index = openId ? items.findIndex((item) => item.id === openId) : -1;
  const open = index === -1 ? null : items[index];
  const step = open ? neighbours(items, open.id) : null;
  if (!open || !step) return null;

  return (
    <Lightbox
      token={token}
      item={open}
      prev={step.prev}
      next={step.next}
      position={index + 1}
      total={items.length}
      preload={upcoming(items, open.id)}
      favorite={favoriteIds.includes(open.id)}
      onToggleFavorite={onToggleFavorite}
      onStep={onStep}
      onClose={onClose}
      onReported={onReported}
    />
  );
}
