"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MdChecklist,
  MdClose,
  MdOutlineExpandMore,
  MdOutlineFileDownload,
} from "react-icons/md";

import { Lightbox } from "@/components/gallery/lightbox";
import { PhotoGallery } from "@/components/gallery/photo-gallery";
import { Button, Hole, cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";
import {
  type GalleryLayout,
  neighbours,
  upcoming,
  withFreshHead,
  withOlder,
} from "@/lib/gallery";

/**
 * How often the wall may ask what is new. Slow enough that a guest sending
 * thirty photographs does not spend their rate limit refreshing.
 */
const REFRESH_EVERY_MS = 3000;

/**
 * How many empty frames stand in for a page on its way. Not the page size:
 * they promise that photographs are coming, not how many.
 */
const PENDING_TILES = 10;

/**
 * What everyone else has uploaded. On by default, but it is the host's switch,
 * and the layout is theirs too - there is no switcher on this page.
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
  const [items, setItems] = useState<MediaView[]>([]);
  /**
   * Counted in the database, not the length of what is loaded - those agree
   * only up to the first page. Null until the first response.
   */
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * A page the guest asked for, rather than one the wall fetched itself. Only
   * the asked-for kind draws frames.
   */
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * An id rather than the photo itself: the lightbox has a position in the
   * wall, and holding the object would keep a deleted photo on screen.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * Guest selection mode: press & hold or tap the select button to enter,
   * then tap photos to add them to the download set.
   */
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const downloadLinkRef = useRef<HTMLAnchorElement>(null);
  /**
   * A refresh that did not land. The wall keeps what it has - a guest
   * mid-scroll must not have it emptied - but says so rather than going quiet.
   */
  const [staleSince, setStaleSince] = useState(false);
  /** Refreshes this component asks for itself, on top of the ones it is told about. */
  const [tick, setTick] = useState(0);

  /*
   * Readable from inside `load` without making `load` change identity on every
   * arrival, which would restart the effect below and double every refresh.
   */
  const shown = useRef<MediaView[]>([]);
  useEffect(() => {
    shown.current = items;
  }, [items]);

  const lastLoadAt = useRef(0);

  const load = useCallback(
    async (before: string | null, replace: boolean) => {
      setLoading(true);
      lastLoadAt.current = Date.now();
      try {
        const url = new URL("/api/gallery", window.location.origin);
        url.searchParams.set("token", token);
        if (before) url.searchParams.set("before", before);

        // The one request in the product that must never be answered from a
        // cache: it is asked again precisely because the answer has changed.
        const res = await fetch(url, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not load.");

        const page = body.items as MediaView[];
        const next = replace
          ? withFreshHead(shown.current, page)
          : withOlder(shown.current, page);

        setItems(next);
        setTotal(typeof body.total === "number" ? body.total : null);
        /*
         * The oldest photograph *held*, not the oldest in this response: a
         * refresh asks for the newest page while the guest may have scrolled
         * past several, and the head's cursor would refetch what they have.
         */
        setCursor(
          body.nextCursor ? (next[next.length - 1]?.createdAt ?? null) : null,
        );
        setError(null);
        setStaleSince(false);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not load the gallery.";
        if (shown.current.length > 0) setStaleSince(true);
        else setError(message);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  /**
   * Photographs land one at a time, so a literal refresh each would be thirty
   * requests a minute from one phone. A burst collapses into the next tick.
   */
  useEffect(() => {
    const wait =
      lastLoadAt.current === 0
        ? 0
        : Math.max(0, REFRESH_EVERY_MS - (Date.now() - lastLoadAt.current));
    const timer = setTimeout(() => load(null, true), wait);
    return () => clearTimeout(timer);
  }, [load, refreshKey, tick]);

  // The evening moved on while the guest was in the camera app.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const openIndex = openId ? items.findIndex((i) => i.id === openId) : -1;
  const open = openIndex === -1 ? null : items[openIndex];
  const step = open
    ? neighbours(
        items.map((i) => i.id),
        open.id,
      )
    : null;

  const isSelected = useCallback(
    (item: MediaView) => selectedIds.has(item.id),
    [selectedIds],
  );

  const handleActivate = useCallback(
    (item: MediaView) => {
      if (selecting) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        });
      } else {
        setOpenId(item.id);
      }
    },
    [selecting],
  );

  const downloadSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/photos/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ids: [...selectedIds] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Could not prepare the download.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = downloadLinkRef.current;
      if (link) {
        link.href = url;
        link.download = `photos-${selectedIds.size}.zip`;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not download.";
      setDownloadError(message);
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }, [token, selectedIds]);

  const exitSelection = useCallback(() => {
    setSelecting(false);
    setSelectedIds(new Set());
    setDownloadError(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setDownloadError(null);
  }, []);

  if (error && items.length === 0) {
    return (
      <section className="mt-10">
        <p className="text-[0.9375rem] text-ash">{error}</p>
      </section>
    );
  }

  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[1.625rem] sm:text-h2">Everyone&apos;s photos</h2>
        {items.length > 0 && !selecting && (
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            {/* The count can lag the wall by one refresh, so the larger of
                the two is the honest one. */}
            {Math.max(total ?? 0, items.length)} so far
          </span>
        )}
      </div>

      {/* Not an error: what is on screen is real, just not the latest. A wall
          that quietly stopped updating looks like a failed upload. */}
      {staleSince && (
        <p className="mt-2 text-[0.9375rem] text-ash">
          Could not check for new photos.{" "}
          <button
            type="button"
            onClick={() => setTick((t) => t + 1)}
            className="underline underline-offset-2"
          >
            Try again
          </button>
        </p>
      )}

      {items.length === 0 && !loading ? (
        <div className="inset-shadow-well mt-6 rounded-[1.25rem] bg-ink/5 px-5 py-8 text-center sm:p-8">
          <div className="mx-auto flex w-fit gap-2">
            <Hole size={16} />
            <Hole size={24} />
            <Hole size={12} />
          </div>
          <p className="mt-5 text-lead">Nothing here yet.</p>
          <p className="mt-1 text-[0.9375rem] text-ash">
            Be the first - yours will appear right here.
          </p>
        </div>
      ) : (
        <PhotoGallery
          items={items}
          layout={layout}
          onActivate={handleActivate}
          isSelected={selecting ? isSelected : undefined}
          /* The first load draws the whole wall as frames rather than an
             empty container. */
          pending={
            loadingMore || (items.length === 0 && loading) ? PENDING_TILES : 0
          }
          className={cx("mt-6", selecting && selectedIds.size > 0 && "pb-20")}
        />
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-paper shadow-[0_-8px_24px_rgba(0,0,0,0.08)] pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={exitSelection}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink/8 text-ink transition-transform active:scale-95"
              aria-label="Close selection"
              title="Close selection"
            >
              <MdClose aria-hidden className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-semibold leading-tight">
                {selectedIds.size === 0
                  ? "Tap photos to select"
                  : `${selectedIds.size} selected`}
              </p>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-[0.8125rem] text-ash underline underline-offset-2"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={downloadSelected}
              disabled={selectedIds.size === 0 || downloading}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-claret px-4 py-3 text-small font-semibold text-chalk shadow-md transition-transform disabled:opacity-45 enabled:active:scale-95"
            >
              <MdOutlineFileDownload aria-hidden className="shrink-0 text-[1.25em]" />
              {downloading ? "Preparing…" : "Download"}
            </button>
          </div>
          {downloadError && (
            <p className="mx-auto max-w-3xl px-4 pb-3 text-[0.8125rem] text-claret sm:px-5">
              {downloadError}
            </p>
          )}
        </div>
      )}

      {!selecting && items.length > 0 && (
        <button
          type="button"
          onClick={() => setSelecting(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-claret px-5 py-3.5 text-small font-semibold text-chalk shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:shadow-md"
          aria-label="Select photos to download"
        >
          <MdChecklist aria-hidden className="shrink-0 text-[1.25em]" />
          Select
        </button>
      )}

      {/* Invisible anchor the download handler clicks to trigger the save dialog,
          kept mounted so we never pay the cost of creating one. */}
      <a ref={downloadLinkRef} aria-hidden="true" className="hidden" />

      {cursor && (
        <Button
          onClick={() => {
            // Set before the request: the frames are the answer to the tap,
            // so they appear with it rather than when the server replies.
            setLoadingMore(true);
            load(cursor, false).finally(() => setLoadingMore(false));
          }}
          variant="secondary"
          disabled={loading}
          className="mt-6 w-full"
        >
          <MdOutlineExpandMore aria-hidden className="shrink-0 text-[1.25em]" />
          {loading ? "Loading…" : "Show more"}
        </Button>
      )}

      {open && step && (
        <Lightbox
          token={token}
          item={open}
          prevId={step.prev}
          nextId={step.next}
          position={openIndex + 1}
          total={items.length}
          /* Fetched behind this one so the next few steps are instant. Recut
             on every step and on every refresh, so a photograph that arrives
             mid-evening joins the queue instead of being the one slow frame. */
          preload={upcoming(items, open.id)}
          onStep={setOpenId}
          onClose={() => setOpenId(null)}
          onReported={(id) => {
            /* Dropped locally rather than waiting for the next refresh. The
               guest who just reported it is looking straight at it, and three
               seconds of it still being there is the whole of their impression
               of whether the button worked. */
            setItems((current) => current.filter((i) => i.id !== id));
            setTotal((count) => (count === null ? null : Math.max(0, count - 1)));
            setOpenId(null);
          }}
        />
      )}
    </section>
  );
}
