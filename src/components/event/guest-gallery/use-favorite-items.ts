"use client";

import { useCallback, useEffect, useState } from "react";

import type { MediaView } from "@/lib/media-view";

/** How many favourites one gallery request takes. The rest go in the next. */
const IDS_PER_REQUEST = 100;

/**
 * The favourites, as the server has them now - fetched by id whenever the tab
 * is open and the list changes.
 *
 * The list itself lives on the guest's phone, so these can be from any point
 * in the evening and cannot be found by paging. Anything the server no longer
 * returns - deleted, held - is forgotten, so the count on the button stays
 * true.
 */
export function useFavoriteItems({
  token,
  active,
  ids,
  forget,
}: {
  token: string;
  /** The favourites tab is the one on screen. Nothing is fetched otherwise. */
  active: boolean;
  ids: string[];
  forget: (gone: string[]) => void;
}) {
  const [found, setFound] = useState<MediaView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    if (ids.length === 0) {
      setFound([]);
      return;
    }
    let live = true;
    setLoading(true);
    (async () => {
      try {
        const items: MediaView[] = [];
        for (let at = 0; at < ids.length; at += IDS_PER_REQUEST) {
          const url = new URL("/api/gallery", window.location.origin);
          url.searchParams.set("token", token);
          url.searchParams.set(
            "ids",
            ids.slice(at, at + IDS_PER_REQUEST).join(","),
          );
          const res = await fetch(url, { cache: "no-store" });
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error?.message ?? "Could not load.");
          items.push(...(body.items as MediaView[]));
        }
        if (!live) return;
        const byId = new Map(items.map((item) => [item.id, item]));
        setFound(ids.flatMap((id) => byId.get(id) ?? []));
        forget(ids.filter((id) => !byId.has(id)));
        setError(null);
      } catch (e) {
        if (live) {
          setError(e instanceof Error ? e.message : "Could not load.");
        }
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [active, ids, forget, token]);

  const drop = useCallback((id: string) => {
    setFound((current) => current.filter((item) => item.id !== id));
  }, []);

  return {
    // Unfavourited in the lightbox: gone from the list straight away, without
    // waiting for the fetch the shorter list sets off.
    items: found.filter((item) => ids.includes(item.id)),
    loading,
    error,
    drop,
  };
}
