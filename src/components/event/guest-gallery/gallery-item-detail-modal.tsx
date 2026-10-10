"use client";

import { Lightbox } from "@/components/gallery/lightbox";
import { neighbours, upcoming } from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

/**
 * One photograph, open over the wall.
 *
 * Takes the id rather than the photograph: the open one has a position in the
 * wall, and holding the object would keep a deleted photo on screen. Nothing
 * is rendered when that id is no longer on the wall, which is what happens
 * when it is deleted while open.
 */
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
  /** The wall this one is open over, which is what prev and next walk. */
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
      /* Fetched behind this one so the next few steps are instant. Recut
         on every step and on every refresh, so a photograph that arrives
         mid-evening joins the queue instead of being the one slow frame. */
      preload={upcoming(items, open.id)}
      favorite={favoriteIds.includes(open.id)}
      onToggleFavorite={onToggleFavorite}
      onStep={onStep}
      onClose={onClose}
      onReported={onReported}
    />
  );
}
