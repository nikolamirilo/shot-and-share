"use client";

import { useCallback, useEffect, useState } from "react";

import { FAVORITE_IDS_PER_REQUEST } from "@/constants/gallery";
import { type MediaView } from "@/types/media";

export function useFavoriteItems({
  token,
  active,
  ids,
  forget,
}: {
  token: string;
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
        for (let at = 0; at < ids.length; at += FAVORITE_IDS_PER_REQUEST) {
          const url = new URL("/api/gallery", window.location.origin);
          url.searchParams.set("token", token);
          url.searchParams.set(
            "ids",
            ids.slice(at, at + FAVORITE_IDS_PER_REQUEST).join(","),
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
    items: found.filter((item) => ids.includes(item.id)),
    loading,
    error,
    drop,
  };
}
