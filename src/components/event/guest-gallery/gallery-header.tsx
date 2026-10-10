"use client";

import type {
  GalleryCounts,
  View,
} from "@/components/event/guest-gallery/use-gallery-wall";
import { Segmented } from "@/components/gallery/segmented";
import { GALLERY_SORTS, type GallerySort } from "@/lib/media-view";

/**
 * The title, how many there are, and the two choices a guest has: which tab,
 * and which order. The layout is the host's and is not one of them.
 */
export function GalleryHeader({
  view,
  sort,
  counts,
  favoriteCount,
  shown,
  total,
  selecting,
  onSwitch,
}: {
  view: View;
  sort: GallerySort;
  counts: GalleryCounts;
  favoriteCount: number;
  /** How many are on the wall right now, for the honest count below. */
  shown: number;
  total: number | null;
  /** The count steps aside while the guest is picking photos to download. */
  selecting: boolean;
  onSwitch: (view: View, sort: GallerySort) => void;
}) {
  /*
   * Tabs only when there is a choice to make. An evening of photographs and
   * nothing else keeps the plain wall it always had.
   */
  const showTabs =
    (counts.video ?? 0) > 0 || favoriteCount > 0 || view !== "photo";
  const tabs = [
    { id: "photo" as const, name: "Photos", count: counts.photo },
    ...((counts.video ?? 0) > 0 || view === "video"
      ? [{ id: "video" as const, name: "Videos", count: counts.video }]
      : []),
    ...(favoriteCount > 0 || view === "favorites"
      ? [
          {
            id: "favorites" as const,
            name: "Favourites",
            count: favoriteCount,
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[1.625rem] sm:text-h2">Everyone&apos;s photos</h2>
        {view !== "favorites" && shown > 0 && !selecting && (
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            {/* The count can lag the wall by one refresh, so the larger of
                the two is the honest one. */}
            {Math.max(total ?? 0, shown)} so far
          </span>
        )}
      </div>

      <div className="-mx-4 mt-4 flex flex-wrap items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {showTabs && (
          <Segmented
            label="Show"
            value={view}
            options={tabs}
            onChange={(next) => {
              if (next !== view) onSwitch(next, sort);
            }}
          />
        )}
        {view !== "favorites" && (
          <Segmented
            label="Order"
            value={sort}
            options={GALLERY_SORTS}
            onChange={(next) => {
              if (next !== sort) onSwitch(view, next);
            }}
            className="sm:ml-auto"
          />
        )}
      </div>
    </>
  );
}
