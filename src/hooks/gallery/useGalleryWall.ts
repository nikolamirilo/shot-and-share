"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { GALLERY_REFRESH_MS } from "@/constants/gallery";
import type { GalleryCounts, View } from "@/types/gallery";

import { withFreshHead, withOlder } from "@/utils/gallery";
import { DEFAULT_SORT, type GallerySort } from "@/constants/gallery";
import { type MediaView } from "@/types/media";
import { cursorOf } from "@/utils/media-view";

export function useGalleryWall({
  token,
  refreshKey,
  onSwitch,
}: {
  token: string;
  refreshKey: number;
  onSwitch?: () => void;
}) {
  const [items, setItems] = useState<MediaView[]>([]);
  const [view, setView] = useState<View>("photo");
  const [sort, setSort] = useState<GallerySort>(DEFAULT_SORT);
  const [counts, setCounts] = useState<GalleryCounts>({
    photo: null,
    video: null,
  });
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [tick, setTick] = useState(0);

  const shown = useRef<MediaView[]>([]);
  useEffect(() => {
    shown.current = items;
  }, [items]);

  const lastLoadAt = useRef(0);
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

        // Must never be answered from a cache: it is asked again because the answer
        // changed.
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

  const openedOnVideos = useRef(false);
  useEffect(() => {
    if (openedOnVideos.current) return;
    if (counts.photo === null || counts.video === null) return;
    openedOnVideos.current = true;
    if (view === "photo" && counts.photo === 0 && counts.video > 0) {
      switchWall("video", sort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts]);

  useEffect(() => {
    const wait =
      lastLoadAt.current === 0
        ? 0
        : Math.max(0, GALLERY_REFRESH_MS - (Date.now() - lastLoadAt.current));
    const timer = setTimeout(() => load(null, true), wait);
    return () => clearTimeout(timer);
  }, [load, refreshKey, tick]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const loadMore = useCallback(() => {
    if (!cursor) return;
    setLoadingMore(true);
    load(cursor, false).finally(() => setLoadingMore(false));
  }, [cursor, load]);

  const retry = useCallback(() => setTick((t) => t + 1), []);

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
