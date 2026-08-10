"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { deleteMedia } from "@/lib/actions/media";
import { Button, ProgressBar, cx } from "@/components/ui";
import { compressImage } from "@/lib/client/codec";
import {
  UploadError,
  postJson,
  uploadToPresigned,
  withRetry,
} from "@/lib/client/upload";
import type { MediaView } from "@/lib/media-view";
import { formatBytes, pluralise } from "@/lib/format";
import {
  ACCEPT_ATTRIBUTE_PHOTO,
  COVER_PAGE_SIZE,
} from "@/lib/media";
import type { PresignedUpload } from "@/lib/storage/types";

/**
 * The cover photograph: everything at the event, and anything the host brings.
 *
 * It used to be the first two dozen photos the console happened to have loaded,
 * which meant a host whose cover shot was taken on the second night could not
 * reach it at all - the picture was in the bucket, in the gallery one tab away,
 * and simply not offered here. Everything is reachable now, twenty at a time,
 * on the keyset cursor the guest gallery already uses.
 *
 * The choosing happens in a dialog rather than in the panel. These controls sit
 * in a column about the width of a phone with the drawing pinned beside them,
 * and a hundred thumbnails do not go in there at any size worth looking at: at
 * 56px a host is choosing between grey smudges, and at a size they can actually
 * recognise a face in, four pages of photographs push the preview off the
 * screen - which is the one thing the whole panel is arranged around. The
 * dialog has the window to itself, so the tiles can be big; the panel keeps one
 * of them, which answers the only question it has to answer standing still:
 * which photograph is it at the moment.
 */
export function CoverPicker({
  eventId,
  photos: firstPage,
  photoCount,
  covers,
  selectedId,
  selectedUrl,
  onSelect,
  maxFileBytes,
  remainingBytes,
}: {
  eventId: string;
  photos: MediaView[];
  photoCount: number;
  covers: MediaView[];
  selectedId: string | null;
  /** What the drawing is showing, so the tile and the preview cannot disagree. */
  selectedUrl: string | null;
  onSelect: (item: MediaView | null) => void;
  maxFileBytes: number;
  remainingBytes: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // The console already loaded these, so the first page costs no request.
  const [photos, setPhotos] = useState(() =>
    firstPage.slice(0, COVER_PAGE_SIZE),
  );
  const [exhausted, setExhausted] = useState(
    () => firstPage.length < COVER_PAGE_SIZE,
  );
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState(covers);
  const [upload, setUpload] = useState<{ name: string; percent: number } | null>(
    null,
  );
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Both halves have to agree before another page is offered: the count is what
  // the database says exists, and `exhausted` is what the last request actually
  // returned. A photo deleted mid-browse makes the first one optimistic.
  const more = !exhausted && photos.length < photoCount;

  // Escape closes it, like every other overlay in the product. An upload in
  // flight is not interrupted by closing - the bytes are already on their way,
  // and the row is written whether or not anyone is looking.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /** Picking is the whole reason the dialog is open, so it also closes it. */
  function choose(item: MediaView | null) {
    onSelect(item);
    setOpen(false);
  }

  async function loadMore() {
    const last = photos[photos.length - 1];
    if (loading || !last) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/events/${eventId}/cover-photos?before=${encodeURIComponent(last.createdAt)}`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as {
        items: MediaView[];
        nextCursor: string | null;
      };

      // Deduplicated on the way in. The cursor is a timestamp, and two photos
      // uploaded in the same millisecond would otherwise arrive twice and give
      // React two children with the same key.
      setPhotos((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...body.items.filter((item) => !seen.has(item.id))];
      });
      if (!body.nextCursor) setExhausted(true);
    } catch {
      setError("Could not load more photos. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function confirmUpload(mediaId: string, rest: Record<string, unknown>) {
    return postJson<{ confirmed: boolean; item: MediaView | null }>(
      `/api/events/${eventId}/cover/confirm`,
      { mediaId, ...rest },
    );
  }

  /**
   * The host's own image, through the same handshake a guest's photo uses: the
   * browser shrinks it, the server signs a URL, the bytes go straight to the
   * bucket, and the row is written only once they are there.
   */
  async function uploadCover(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("A cover has to be an image rather than a video.");
      return;
    }
    if (file.size > maxFileBytes) {
      setError(
        `That image is bigger than ${formatBytes(maxFileBytes, 0)}, which is the most we can take in one file.`,
      );
      return;
    }

    setUpload({ name: file.name, percent: 0 });
    try {
      const prepared = await compressImage(file);

      const { upload: signed } = await withRetry(() =>
        postJson<{
          upload: {
            mediaId: string;
            source: "file" | "compressed";
            media: PresignedUpload;
          };
        }>(`/api/events/${eventId}/cover/presign`, {
          file: {
            size: file.size,
            type: file.type,
            compressed: prepared.compressed
              ? {
                  size: prepared.compressed.blob.size,
                  format: prepared.compressed.format,
                  width: prepared.compressed.width,
                  height: prepared.compressed.height,
                }
              : null,
            sourceWidth: prepared.sourceWidth,
            sourceHeight: prepared.sourceHeight,
            needsServer: prepared.needsServer,
          },
        }),
      );

      const body =
        signed.source === "compressed" && prepared.compressed
          ? prepared.compressed.blob
          : file;

      try {
        await withRetry(() =>
          uploadToPresigned(signed.media, body, (fraction) =>
            setUpload((prev) =>
              prev ? { ...prev, percent: Math.round(fraction * 100) } : prev,
            ),
          ),
        );
      } catch (e) {
        // Give the reserved space back rather than leaving it on the host's
        // quota until the nightly sweep gets to it.
        await confirmUpload(signed.mediaId, {
          mediaUploaded: false,
          failed: true,
        }).catch(() => {
          /* the sweep is the backstop */
        });
        throw e;
      }

      const result = await withRetry(() =>
        confirmUpload(signed.mediaId, {
          width: prepared.sourceWidth,
          height: prepared.sourceHeight,
          mediaUploaded: true,
        }),
      );

      if (!result.confirmed || !result.item) {
        throw new UploadError("The image went up but could not be saved.");
      }

      const item = result.item;
      setUploads((prev) => [item, ...prev]);
      // Uploading a cover is choosing one, so it lands the same way a tap does
      // and hands the host back to the drawing. It is still only a draft: the
      // row is not touched until Save changes.
      choose(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image did not upload.");
    } finally {
      setUpload(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeUpload(item: MediaView) {
    setError(null);
    setRemoving(item.id);

    const result = await deleteMedia(eventId, [item.id]).catch(() => ({
      error: "That did not delete. Check your connection and try again.",
    }));

    setRemoving(null);
    if (result.error) {
      setError(result.error);
      return;
    }

    setUploads((prev) => prev.filter((u) => u.id !== item.id));
    if (selectedId === item.id) onSelect(null);
  }

  return (
    <>
      {/* Outside the dialog on purpose. It is what the Upload button clicks,
          and the dialog closes on a successful upload - an input inside it
          would be gone before the handler had finished tidying up after
          itself. */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE_PHOTO}
        id="cover-file"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadCover(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-linen shadow-md">
          {selectedUrl ? (
            <Image
              src={selectedUrl}
              alt=""
              width={128}
              height={128}
              sizes="128px"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-micro uppercase text-mist">
              none
            </span>
          )}
        </span>

        <div className="min-w-0">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setOpen(true)}
          >
            {selectedUrl ? "Change the cover photo" : "Choose a cover photo"}
          </Button>
          <p className="mt-1.5 text-label text-ash">
            {photoCount === 0
              ? "No photos from guests yet - you can upload your own."
              : `${pluralise(photoCount, "photo")} from the event, or upload your own.`}
          </p>
        </div>
      </div>

      {/* The error lives out here too. An upload that failed closes nothing,
          but one that failed after the host had already closed the dialog would
          otherwise report itself to an empty room. */}
      {!open && error && (
        <p className="note mt-3 p-3 text-label font-semibold leading-snug">
          {error}
        </p>
      )}

      {open && (
        <div
          /* Safe-area padding at the bottom: on a phone the home indicator sits
             exactly where the last row of tiles lands. */
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-ink/92 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choose a cover photo"
          onClick={() => setOpen(false)}
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
                  disabled={Boolean(upload)}
                  onClick={() => inputRef.current?.click()}
                >
                  {upload ? `Uploading… ${upload.percent}%` : "Upload your own"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  autoFocus
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>

            {(upload || error) && (
              <div className="relative z-10 bg-linen p-4 shadow-sm sm:p-5">
                {upload && (
                  <>
                    <ProgressBar percent={upload.percent} />
                    <p className="mt-1.5 truncate text-label text-ash">
                      {upload.name}
                    </p>
                  </>
                )}
                {error && (
                  <p
                    className={cx(
                      "text-label font-semibold leading-snug",
                      upload && "mt-2.5",
                    )}
                  >
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* The one part that scrolls. `min-h-0` is what lets it: a flex
                child will not shrink below its content without it, and the
                panel would grow past the window instead of the grid gaining a
                scrollbar. */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2.5 xs:grid-cols-4 sm:grid-cols-5">
                <button
                  type="button"
                  onClick={() => choose(null)}
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

                {/* The host's own, first and marked. The cross is a sibling
                    rather than a child of the tile: a button inside a button is
                    not markup a browser agrees to render. */}
                {uploads.map((item) => (
                  <div key={item.id} className="relative">
                    <CoverThumb
                      item={item}
                      selected={selectedId === item.id}
                      onClick={() => choose(item)}
                    />
                    <button
                      type="button"
                      title="Delete this cover image"
                      aria-label="Delete this cover image"
                      disabled={removing === item.id}
                      onClick={() => void removeUpload(item)}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-paper text-label font-bold leading-none shadow-md disabled:opacity-45"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {photos.map((item) => (
                  <CoverThumb
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onClick={() => choose(item)}
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
                  onClick={() => void loadMore()}
                >
                  {loading ? "Loading…" : `Load ${COVER_PAGE_SIZE} more`}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * A square, whatever shape the photograph is.
 *
 * The tiles are a grid rather than a wrapping row so that the columns line up
 * down the dialog: a row of mixed aspect ratios reads as a jumble, and what the
 * host is scanning for is one picture among a hundred.
 */
const TILE =
  "relative aspect-square w-full overflow-hidden rounded-xl bg-linen shadow-sm transition-shadow";
const TILE_SELECTED = "shadow-lg";

/**
 * Which one is chosen.
 *
 * This was a ring, and a ring is a border wearing a different name. A mark
 * printed on the photograph is also the stronger signal of the two: the tiles
 * are a hundred squares of somebody's wedding, and an edge four pixels wide is
 * easy to lose among them in a way that a Gouda disc is not.
 */
function Chosen() {
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-claret text-chalk shadow-md"
    >
      <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none">
        <path
          d="M2.5 6.4 4.9 8.8 9.5 3.4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function CoverThumb({
  item,
  selected,
  onClick,
}: {
  item: MediaView;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(TILE, selected && TILE_SELECTED)}
    >
      {item.previewUrl && (
        // Through the optimiser, not a bare <img>. `previewUrl` is the stored
        // photo - a phone camera's several megabytes - and a grid of a hundred
        // of them at full size is the whole gallery pulled down to fill tiles
        // a couple of hundred pixels wide.
        <Image
          src={item.previewUrl}
          alt=""
          width={320}
          height={320}
          sizes="320px"
          className="h-full w-full object-cover"
        />
      )}
      {selected && <Chosen />}
    </button>
  );
}
