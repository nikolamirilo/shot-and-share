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
import { Segmented } from "@/components/gallery/segmented";
import { Button, Hole, cx } from "@/components/ui";
import { useFavorites } from "@/lib/client/favorites";
import {
  DEFAULT_SORT,
  GALLERY_SORTS,
  type GallerySort,
  type MediaView,
  cursorOf,
} from "@/lib/media-view";
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

/** What the download route takes in one ZIP. Bigger lists become several. */
const DOWNLOAD_BATCH = 100;

/** Photos and videos are separate walls; favourites is the guest's own list. */
type View = "photo" | "video" | "favorites";

/**
 * Save a ZIP of these ids through the download route. One ZIP per hundred,
 * which is the route's ceiling, so a long shortlist still downloads whole.
 */
async function downloadZips(
  token: string,
  ids: string[],
  link: HTMLAnchorElement | null,
  name: string,
) {
  const batches: string[][] = [];
  for (let at = 0; at < ids.length; at += DOWNLOAD_BATCH) {
    batches.push(ids.slice(at, at + DOWNLOAD_BATCH));
  }
  for (const [index, batch] of batches.entries()) {
    const res = await fetch("/api/photos/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ids: batch }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error?.message ?? "Could not prepare the download.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (link) {
      link.href = url;
      link.download =
        batches.length > 1
          ? `${name}-${index + 1}-of-${batches.length}.zip`
          : `${name}.zip`;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

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
  /** Photos, videos, or the guest's favourites. Photos first. */
  const [view, setView] = useState<View>("photo");
  /** Newest arrivals first unless the guest asks for the evening in order. */
  const [sort, setSort] = useState<GallerySort>(DEFAULT_SORT);
  /** How many of each a guest can see, for the tab labels. */
  const [counts, setCounts] = useState<{
    photo: number | null;
    video: number | null;
  }>({ photo: null, video: null });
  const favorites = useFavorites(token);
  /** The favourites, as the server has them now - fetched by id. */
  const [favoriteItems, setFavoriteItems] = useState<MediaView[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
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
  /**
   * Bumped whenever the tab or the order changes. A response that set off
   * under the old one is about a different wall and is dropped on arrival.
   */
  const generation = useRef(0);

  const load = useCallback(
    async (before: string | null, replace: boolean) => {
      if (view === "favorites") return;
      const asked = generation.current;
      setLoading(true);
      lastLoadAt.current = Date.now();
      try {
        const url = new URL("/api/gallery", window.location.origin);
        url.searchParams.set("token", token);
        url.searchParams.set("kind", view);
        url.searchParams.set("sort", sort);
        if (before) url.searchParams.set("before", before);

        // The one request in the product that must never be answered from a
        // cache: it is asked again precisely because the answer has changed.
        const res = await fetch(url, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Could not load.");
        if (asked !== generation.current) return;

        const page = body.items as MediaView[];
        const next = replace
          ? withFreshHead(shown.current, page, sort)
          : withOlder(shown.current, page);

        setItems(next);
        setTotal(typeof body.total === "number" ? body.total : null);
        if (body.counts) setCounts(body.counts);
        /*
         * The oldest photograph *held*, not the oldest in this response: a
         * refresh asks for the newest page while the guest may have scrolled
         * past several, and the head's cursor would refetch what they have.
         */
        const oldest = next[next.length - 1];
        setCursor(body.nextCursor && oldest ? cursorOf(oldest, sort) : null);
        setError(null);
        setStaleSince(false);
      } catch (e) {
        if (asked !== generation.current) return;
        const message =
          e instanceof Error ? e.message : "Could not load the gallery.";
        if (shown.current.length > 0) setStaleSince(true);
        else setError(message);
      } finally {
        if (asked === generation.current) setLoading(false);
      }
    },
    [token, view, sort],
  );

  /** A different tab or order is a different wall: start it from the top. */
  function switchWall(nextView: View, nextSort: GallerySort) {
    generation.current += 1;
    shown.current = [];
    setItems([]);
    setCursor(null);
    setTotal(null);
    setError(null);
    setStaleSince(false);
    setOpenId(null);
    setSelectedIds(new Set());
    setLoading(nextView !== "favorites");
    lastLoadAt.current = 0;
    setView(nextView);
    setSort(nextSort);
  }

  /*
   * An event with clips and no photographs opens on the clips, rather than on
   * an empty Photos tab above a Videos tab with everything in it.
   */
  const openedOnVideos = useRef(false);
  useEffect(() => {
    if (openedOnVideos.current) return;
    if (counts.photo === null || counts.video === null) return;
    openedOnVideos.current = true;
    if (view === "photo" && counts.photo === 0 && counts.video > 0) {
      switchWall("video", sort);
    }
    // switchWall is a plain function over state setters; the counts decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts]);

  /*
   * The favourites tab, fetched by id whenever it is open and the list
   * changes. Anything the server no longer returns - deleted, held - is
   * forgotten, so the count on the button stays true.
   */
  const favoriteIds = favorites.ids;
  const forgetFavorites = favorites.forget;
  useEffect(() => {
    if (view !== "favorites") return;
    if (favoriteIds.length === 0) {
      setFavoriteItems([]);
      return;
    }
    let live = true;
    setFavoritesLoading(true);
    (async () => {
      try {
        const found: MediaView[] = [];
        for (let at = 0; at < favoriteIds.length; at += DOWNLOAD_BATCH) {
          const url = new URL("/api/gallery", window.location.origin);
          url.searchParams.set("token", token);
          url.searchParams.set(
            "ids",
            favoriteIds.slice(at, at + DOWNLOAD_BATCH).join(","),
          );
          const res = await fetch(url, { cache: "no-store" });
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error?.message ?? "Could not load.");
          found.push(...(body.items as MediaView[]));
        }
        if (!live) return;
        const byId = new Map(found.map((item) => [item.id, item]));
        setFavoriteItems(
          favoriteIds.flatMap((id) => byId.get(id) ?? []),
        );
        forgetFavorites(favoriteIds.filter((id) => !byId.has(id)));
        setError(null);
      } catch (e) {
        if (live) {
          setError(e instanceof Error ? e.message : "Could not load.");
        }
      } finally {
        if (live) setFavoritesLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [view, favoriteIds, forgetFavorites, token]);

  /** What is on the wall right now: the tab's page, or the favourites. */
  const wall =
    view === "favorites"
      ? // Unfavourited in the lightbox: gone from the list straight away.
        favoriteItems.filter((item) => favoriteIds.includes(item.id))
      : items;
  const wallLoading = view === "favorites" ? favoritesLoading : loading;

  const [savingFavorites, setSavingFavorites] = useState(false);
  const downloadFavorites = useCallback(async () => {
    if (favoriteIds.length === 0) return;
    setSavingFavorites(true);
    setDownloadError(null);
    try {
      await downloadZips(
        token,
        favoriteIds,
        downloadLinkRef.current,
        `favourites-${favoriteIds.length}`,
      );
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Could not download.",
      );
    } finally {
      setSavingFavorites(false);
    }
  }, [token, favoriteIds]);

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

  const openIndex = openId ? wall.findIndex((i) => i.id === openId) : -1;
  const open = openIndex === -1 ? null : wall[openIndex];
  const step = open
    ? neighbours(
        wall.map((i) => i.id),
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
      await downloadZips(
        token,
        [...selectedIds],
        downloadLinkRef.current,
        `photos-${selectedIds.size}`,
      );
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

  /*
   * Tabs only when there is a choice to make. An evening of photographs and
   * nothing else keeps the plain wall it always had.
   */
  const showTabs =
    (counts.video ?? 0) > 0 || favoriteIds.length > 0 || view !== "photo";
  const tabs = [
    { id: "photo" as const, name: "Photos", count: counts.photo },
    ...((counts.video ?? 0) > 0 || view === "video"
      ? [{ id: "video" as const, name: "Videos", count: counts.video }]
      : []),
    ...(favoriteIds.length > 0 || view === "favorites"
      ? [
          {
            id: "favorites" as const,
            name: "Favourites",
            count: favoriteIds.length,
          },
        ]
      : []),
  ];

  const noun = view === "video" ? "videos" : "photos";

  return (
    <section className="mt-10 sm:mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[1.625rem] sm:text-h2">Everyone&apos;s photos</h2>
        {view !== "favorites" && items.length > 0 && !selecting && (
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            {/* The count can lag the wall by one refresh, so the larger of
                the two is the honest one. */}
            {Math.max(total ?? 0, items.length)} so far
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
              if (next !== view) switchWall(next, sort);
            }}
          />
        )}
        {view !== "favorites" && (
          <Segmented
            label="Order"
            value={sort}
            options={GALLERY_SORTS}
            onChange={(next) => {
              if (next !== sort) switchWall(view, next);
            }}
            className="sm:ml-auto"
          />
        )}
      </div>

      {error && wall.length === 0 && (
        <p className="mt-6 text-[0.9375rem] text-ash">{error}</p>
      )}

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

      {view === "favorites" && favoriteIds.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.9375rem] text-ash">
            Saved on this phone only. Tap the heart on a photo to add or remove
            it.
          </p>
          <Button
            onClick={downloadFavorites}
            disabled={savingFavorites}
            size="sm"
          >
            <MdOutlineFileDownload
              aria-hidden
              className="shrink-0 text-[1.25em]"
            />
            {savingFavorites
              ? "Preparing…"
              : `Download ${favoriteIds.length === 1 ? "favourite" : `all ${favoriteIds.length}`}`}
          </Button>
          {downloadError && (
            <p className="w-full text-[0.8125rem] text-claret">
              {downloadError}
            </p>
          )}
        </div>
      )}

      {error && wall.length === 0 ? null : wall.length === 0 && !wallLoading ? (
        <div className="inset-shadow-well mt-6 rounded-[1.25rem] bg-ink/5 px-5 py-8 text-center sm:p-8">
          <div className="mx-auto flex w-fit gap-2">
            <Hole size={16} />
            <Hole size={24} />
            <Hole size={12} />
          </div>
          {view === "favorites" ? (
            <>
              <p className="mt-5 text-lead">No favourites yet.</p>
              <p className="mt-1 text-[0.9375rem] text-ash">
                Open a photo and tap the heart to keep it here.
              </p>
            </>
          ) : (
            <>
              <p className="mt-5 text-lead">No {noun} yet.</p>
              <p className="mt-1 text-[0.9375rem] text-ash">
                Be the first - yours will appear right here.
              </p>
            </>
          )}
        </div>
      ) : (
        <PhotoGallery
          items={wall}
          layout={layout}
          onActivate={handleActivate}
          isSelected={selecting ? isSelected : undefined}
          isFavorite={(item) => favoriteIds.includes(item.id)}
          /* The first load draws the whole wall as frames rather than an
             empty container. */
          pending={
            loadingMore || (wall.length === 0 && wallLoading)
              ? PENDING_TILES
              : 0
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

      {!selecting && view !== "favorites" && items.length > 0 && (
        <button
          type="button"
          onClick={() => setSelecting(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-ink/10 bg-blush px-5 py-3.5 text-small font-semibold text-ink shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:shadow-md"
          aria-label="Select photos to download"
        >
          <MdChecklist aria-hidden className="shrink-0 text-[1.25em]" />
          Select
        </button>
      )}

      {/* Invisible anchor the download handler clicks to trigger the save dialog,
          kept mounted so we never pay the cost of creating one. */}
      <a ref={downloadLinkRef} aria-hidden="true" className="hidden" />

      {cursor && view !== "favorites" && (
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
          total={wall.length}
          /* Fetched behind this one so the next few steps are instant. Recut
             on every step and on every refresh, so a photograph that arrives
             mid-evening joins the queue instead of being the one slow frame. */
          preload={upcoming(wall, open.id)}
          favorite={favoriteIds.includes(open.id)}
          onToggleFavorite={favorites.toggle}
          onStep={setOpenId}
          onClose={() => setOpenId(null)}
          onReported={(id) => {
            /* Dropped locally rather than waiting for the next refresh. The
               guest who just reported it is looking straight at it, and three
               seconds of it still being there is the whole of their impression
               of whether the button worked. */
            setItems((current) => current.filter((i) => i.id !== id));
            setFavoriteItems((current) => current.filter((i) => i.id !== id));
            setTotal((count) => (count === null ? null : Math.max(0, count - 1)));
            setOpenId(null);
          }}
        />
      )}
    </section>
  );
}
