"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { withFreshHead, withOlder } from "@/lib/gallery";
import {
  DEFAULT_SORT,
  type GallerySort,
  type MediaView,
  cursorOf,
} from "@/lib/media-view";

/**
 * How often the wall may ask what is new. Slow enough that a guest sending
 * thirty photographs does not spend their rate limit refreshing.
 */
const REFRESH_EVERY_MS = 3000;

/** Photos and videos are separate walls; favourites is the guest's own list. */
export type View = "photo" | "video" | "favorites";

/** How many of each a guest can see, for the tab labels. */
export type GalleryCounts = {
  photo: number | null;
  video: number | null;
};

/**
 * The photographs on the wall: one page at a time, kept up to date, in the tab
 * and the order the guest asked for.
 *
 * Favourites are not here - they are the guest's own list, fetched by id - so
 * every load this hook makes is for the Photos or the Videos tab.
 */
export function useGalleryWall({
  token,
  refreshKey,
  onSwitch,
}: {
  token: string;
  refreshKey: number;
  /**
   * The wall restarted on a new tab or a new order. For whatever else is tied
   * to the old one and is not the wall's to reset - the open photograph, the
   * selection.
   */
  onSwitch?: () => void;
}) {
  const [items, setItems] = useState<MediaView[]>([]);
  /** Photos, videos, or the guest's favourites. Photos first. */
  const [view, setView] = useState<View>("photo");
  /** Newest arrivals first unless the guest asks for the evening in order. */
  const [sort, setSort] = useState<GallerySort>(DEFAULT_SORT);
  const [counts, setCounts] = useState<GalleryCounts>({
    photo: null,
    video: null,
  });
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
   * A refresh that did not land. The wall keeps what it has - a guest
   * mid-scroll must not have it emptied - but says so rather than going quiet.
   */
  const [stale, setStale] = useState(false);
  /** Refreshes this wall asks for itself, on top of the ones it is told about. */
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
        setStale(false);
      } catch (e) {
        if (asked !== generation.current) return;
        const message =
          e instanceof Error ? e.message : "Could not load the gallery.";
        if (shown.current.length > 0) setStale(true);
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
    setStale(false);
    setLoading(nextView !== "favorites");
    lastLoadAt.current = 0;
    setView(nextView);
    setSort(nextSort);
    onSwitch?.();
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

  /** "Show more": the next page onto the end of what is held. */
  const loadMore = useCallback(() => {
    if (!cursor) return;
    // Set before the request: the frames are the answer to the tap, so they
    // appear with it rather than when the server replies.
    setLoadingMore(true);
    load(cursor, false).finally(() => setLoadingMore(false));
  }, [cursor, load]);

  /** Ask again after a refresh that did not land. */
  const retry = useCallback(() => setTick((t) => t + 1), []);

  /**
   * Take one off the wall now rather than at the next refresh - what a guest
   * who has just reported a photograph is looking straight at.
   */
  const drop = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setTotal((count) => (count === null ? null : Math.max(0, count - 1)));
  }, []);

  return {
    view,
    sort,
    items,
    counts,
    total,
    cursor,
    loading,
    loadingMore,
    error,
    stale,
    switchWall,
    loadMore,
    retry,
    drop,
  };
}
