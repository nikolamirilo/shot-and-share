"use client";

import { useCallback, useState } from "react";
import { MdOutlineExpandMore } from "react-icons/md";

import { FavoritesBar } from "@/components/event/guest-gallery/FavoritesBar";
import { GalleryHeader } from "@/components/event/guest-gallery/GalleryHeader";
import { GalleryItemDetailModal } from "@/components/event/guest-gallery/GalleryItemDetailModal";
import { GalleryItems } from "@/components/event/guest-gallery/GalleryItems";
import { SelectButton } from "@/components/event/guest-gallery/SelectButton";
import { SelectionBar } from "@/components/event/guest-gallery/SelectionBar";
import { useFavoriteItems } from "@/hooks/gallery/useFavoriteItems";
import { useGallerySelection } from "@/hooks/gallery/useGallerySelection";
import { useGalleryWall } from "@/hooks/gallery/useGalleryWall";
import { useZipDownload } from "@/hooks/gallery/useZipDownload";
import { Button } from "@/components/ui";
import { useFavorites } from "@/hooks/useFavorites";
import { type GalleryLayout } from "@/constants/gallery";
import { type MediaView } from "@/types/media";

export function GuestGallery({
  token,
  refreshKey,
  layout,
}: {
  token: string;
  refreshKey: number;
  layout: GalleryLayout;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selection = useGallerySelection();
  const download = useZipDownload(token);
  const favorites = useFavorites(token);

  const { selecting, toggle: toggleSelected, clear: clearSelected } = selection;
  const { clearError } = download;

  const onSwitch = useCallback(() => {
    setOpenId(null);
    clearSelected();
    clearError();
  }, [clearSelected, clearError]);

  const wall = useGalleryWall({ token, refreshKey, onSwitch });
  const favoriteWall = useFavoriteItems({
    token,
    active: wall.view === "favorites",
    ids: favorites.ids,
    forget: favorites.forget,
  });

  const showingFavorites = wall.view === "favorites";
  const items = showingFavorites ? favoriteWall.items : wall.items;
  const loading = showingFavorites ? favoriteWall.loading : wall.loading;
  const error = showingFavorites ? favoriteWall.error : wall.error;

  const activate = useCallback(
    (item: MediaView) => {
      if (selecting) toggleSelected(item.id);
      else setOpenId(item.id);
    },
    [selecting, toggleSelected],
  );

  return (
    <section className="mt-10 sm:mt-12">
      <GalleryHeader
        view={wall.view}
        sort={wall.sort}
        counts={wall.counts}
        favoriteCount={favorites.ids.length}
        shown={wall.items.length}
        total={wall.total}
        selecting={selecting}
        onSwitch={wall.switchWall}
      />

      {error && items.length === 0 && (
        <p className="mt-6 text-[0.9375rem] text-ash">{error}</p>
      )}

      {wall.stale && (
        <p className="mt-2 text-[0.9375rem] text-ash">
          Could not check for new photos.{" "}
          <button
            type="button"
            onClick={wall.retry}
            className="underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      )}

      {showingFavorites && favorites.ids.length > 0 && (
        <FavoritesBar
          count={favorites.ids.length}
          pending={download.pending}
          error={download.error}
          onDownload={() =>
            download.save(favorites.ids, `favourites-${favorites.ids.length}`)
          }
        />
      )}

      {error && items.length === 0 ? null : (
        <GalleryItems
          items={items}
          layout={layout}
          view={wall.view}
          loading={loading}
          loadingMore={wall.loadingMore}
          selecting={selecting}
          selectedCount={selection.count}
          isSelected={selection.isSelected}
          isFavorite={(item) => favorites.ids.includes(item.id)}
          onActivate={activate}
        />
      )}

      {selecting && (
        <SelectionBar
          count={selection.count}
          downloading={download.pending}
          error={download.error}
          onExit={() => {
            selection.exit();
            clearError();
          }}
          onClear={() => {
            clearSelected();
            clearError();
          }}
          onDownload={() =>
            download.save([...selection.ids], `photos-${selection.count}`)
          }
        />
      )}

      {!selecting && !showingFavorites && wall.items.length > 0 && (
        <SelectButton onClick={selection.start} />
      )}

      <a ref={download.linkRef} aria-hidden="true" className="hidden" />

      {wall.cursor && !showingFavorites && (
        <Button
          onClick={wall.loadMore}
          variant="secondary"
          disabled={wall.loading}
          className="mt-6 w-full"
        >
          <MdOutlineExpandMore aria-hidden className="shrink-0 text-[1.25em]" />
          {wall.loading ? "Loading…" : "Show more"}
        </Button>
      )}

      <GalleryItemDetailModal
        token={token}
        items={items}
        openId={openId}
        favoriteIds={favorites.ids}
        onToggleFavorite={favorites.toggle}
        onStep={setOpenId}
        onClose={() => setOpenId(null)}
        onReported={(id) => {
          wall.drop(id);
          favoriteWall.drop(id);
          setOpenId(null);
        }}
      />
    </section>
  );
}
