"use client";

import { useEffect } from "react";
import {
  MdClose,
  MdOutlineExpandMore,
  MdOutlineFileUpload,
} from "react-icons/md";

import {
  Chosen,
  CoverThumb,
  TILE,
  TILE_SELECTED,
} from "@/components/dashboard/appearance/cover-thumb";
import { Button, ProgressBar, cx } from "@/components/ui";
import { formatBytes, pluralise } from "@/lib/format";
import { COVER_PAGE_SIZE } from "@/lib/media";
import type { MediaView } from "@/lib/media-view";

/**
 * Choosing happens in a dialog rather than in the panel.
 *
 * The panel's controls sit in a column about the width of a phone with the
 * drawing pinned beside them, and a hundred thumbnails do not go in there at
 * any size worth looking at: at 56px a host is choosing between grey smudges,
 * and at a size they can recognise a face in, four pages of photographs push
 * the preview off the screen. The dialog has the window to itself.
 */
export function CoverDialog({
  photos,
  uploads,
  photoCount,
  selectedId,
  remainingBytes,
  more,
  loading,
  uploading,
  removing,
  error,
  onChoose,
  onClose,
  onLoadMore,
  onPickFile,
  onRemove,
}: {
  photos: MediaView[];
  uploads: MediaView[];
  photoCount: number;
  selectedId: string | null;
  remainingBytes: number;
  more: boolean;
  loading: boolean;
  uploading: { name: string; percent: number } | null;
  removing: string | null;
  error: string | null;
  onChoose: (item: MediaView | null) => void;
  onClose: () => void;
  onLoadMore: () => void;
  onPickFile: () => void;
  onRemove: (item: MediaView) => void;
}) {
  // Escape closes it, like every other overlay in the product. An upload in
  // flight is not interrupted by closing - the bytes are already on their way,
  // and the row is written whether or not anyone is looking.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      /* Safe-area padding at the bottom: on a phone the home indicator sits
         exactly where the last row of tiles lands. `h-[100dvh]` for the same
         reason - `inset-0` is the window with the browser's bars hidden, which
         is not the window anybody is looking at. */
      className="fixed inset-0 z-50 flex h-[100dvh] items-center justify-center overscroll-contain bg-ink/92 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a cover photo"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-card bg-paper shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 bg-linen p-4 shadow-sm sm:p-5">
          <div className="min-w-0">
            <h3 className="text-h3">Choose a cover photo</h3>
            <p className="mt-1 text-label text-ash">
              Tap one to use it. {formatBytes(remainingBytes)} of room left.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={Boolean(uploading)}
              onClick={onPickFile}
            >
              <MdOutlineFileUpload aria-hidden className="shrink-0 text-[1.25em]" />
              {uploading ? `Uploading… ${uploading.percent}%` : "Upload your own"}
            </Button>
            <Button type="button" size="sm" autoFocus onClick={onClose}>
              <MdClose aria-hidden className="shrink-0 text-[1.25em]" />
              Close
            </Button>
          </div>
        </div>

        {(uploading || error) && (
          <div className="relative z-10 bg-linen p-4 shadow-sm sm:p-5">
            {uploading && (
              <>
                <ProgressBar percent={uploading.percent} />
                <p className="mt-1.5 truncate text-label text-ash">
                  {uploading.name}
                </p>
              </>
            )}
            {error && (
              <p
                className={cx(
                  "text-label font-semibold leading-snug",
                  uploading && "mt-2.5",
                )}
              >
                {error}
              </p>
            )}
          </div>
        )}

        {/* The one part that scrolls. `min-h-0` is what lets it: a flex child
            will not shrink below its content without it, and the panel would
            grow past the window instead of the grid gaining a scrollbar. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2.5 xs:grid-cols-4 sm:grid-cols-5">
            <button
              type="button"
              onClick={() => onChoose(null)}
              aria-pressed={selectedId === null}
              className={cx(
                TILE,
                "flex items-center justify-center font-mono text-micro uppercase",
                selectedId === null ? "bg-claret text-chalk" : "bg-linen",
                selectedId === null && TILE_SELECTED,
              )}
            >
              none
              {selectedId === null && <Chosen />}
            </button>

            {/* The host's own, first and marked. The cross is a sibling rather
                than a child of the tile: a button inside a button is not markup
                a browser agrees to render. */}
            {uploads.map((item) => (
              <div key={item.id} className="relative">
                <CoverThumb
                  item={item}
                  selected={selectedId === item.id}
                  onClick={() => onChoose(item)}
                />
                <button
                  type="button"
                  title="Delete this cover image"
                  aria-label="Delete this cover image"
                  disabled={removing === item.id}
                  onClick={() => onRemove(item)}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-paper text-label font-bold leading-none shadow-md disabled:opacity-45"
                >
                  <MdClose aria-hidden />
                </button>
              </div>
            ))}

            {photos.map((item) => (
              <CoverThumb
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onClick={() => onChoose(item)}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-linen p-4 shadow-sm sm:p-5">
          <span className="text-label text-ash">
            {photoCount === 0
              ? "No photos from guests yet."
              : `Showing ${photos.length} of ${pluralise(photoCount, "photo")} from the event.`}
          </span>
          {more && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={onLoadMore}
            >
              <MdOutlineExpandMore aria-hidden className="shrink-0 text-[1.25em]" />
              {loading ? "Loading…" : `Load ${COVER_PAGE_SIZE} more`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
