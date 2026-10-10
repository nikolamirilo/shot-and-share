"use client";

import { useCallback, useState } from "react";
import { MdOutlineExpandMore } from "react-icons/md";

import { FavoritesBar } from "@/components/event/guest-gallery/favorites-bar";
import { GalleryHeader } from "@/components/event/guest-gallery/gallery-header";
import { GalleryItemDetailModal } from "@/components/event/guest-gallery/gallery-item-detail-modal";
import { GalleryItems } from "@/components/event/guest-gallery/gallery-items";
import { SelectButton } from "@/components/event/guest-gallery/select-button";
import { SelectionBar } from "@/components/event/guest-gallery/selection-bar";
import { useFavoriteItems } from "@/components/event/guest-gallery/use-favorite-items";
import { useGallerySelection } from "@/components/event/guest-gallery/use-gallery-selection";
import { useGalleryWall } from "@/components/event/guest-gallery/use-gallery-wall";
import { useZipDownload } from "@/components/event/guest-gallery/use-zip-download";
import { Button } from "@/components/ui";
import { useFavorites } from "@/lib/client/favorites";
import type { GalleryLayout } from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

/**
 * What everyone else has uploaded. On by default, but it is the host's switch,
 * and the layout is theirs too - there is no switcher on this page.
 *
 * Three tabs over two sources: the Photos and Videos walls are pages from the
 * gallery route, and Favourites is the guest's own list off their phone,
 * fetched by id. Everything below is the wiring between them and the chrome.
 */
export function GuestGallery({
  token,
  refreshKey,
  layout,
}: {
  token: string;
  refreshKey: number;
  /** The event's layout, set by the host. Guests do not change it. */
  layout: GalleryLayout;
}) {
  /**
   * An id rather than the photo itself: the lightbox has a position in the
   * wall, and holding the object would keep a deleted photo on screen.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  const selection = useGallerySelection();
  const download = useZipDownload(token);
  const favorites = useFavorites(token);

  // Pulled out of the two objects above so the callbacks below can depend on
  // the functions themselves, which do not change, rather than their holders.
  const { selecting, toggle: toggleSelected, clear: clearSelected } = selection;
  const { clearError } = download;

  /** A new tab or order is a different wall: nothing from the old one stays. */
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

  /** What is on the wall right now: the tab's page, or the favourites. */
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

      {/* Not an error: what is on screen is real, just not the latest. A wall
          that quietly stopped updating looks like a failed upload. */}
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

      {/* Invisible anchor the download handler clicks to trigger the save dialog,
          kept mounted so we never pay the cost of creating one. */}
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
          /* Dropped locally rather than waiting for the next refresh. The
             guest who just reported it is looking straight at it, and three
             seconds of it still being there is the whole of their impression
             of whether the button worked. */
          wall.drop(id);
          favoriteWall.drop(id);
          setOpenId(null);
        }}
      />
    </section>
  );
}
