"use client";

import { useCallback, useEffect, useState } from "react";

import {
  MAX_FAVORITES,
  favoritesKey,
  readFavorites,
  writeFavorites,
} from "@/lib/client/favorites";

/**
 * The list, newest favourite first, and a way to flip one.
 *
 * Starts empty and reads storage after mounting, so the server render and the
 * first client render agree.
 */
export function useFavorites(scope: string) {
  const key = favoritesKey(scope);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readFavorites(key));
    // Another tab of the same event changed the list.
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setIds(readFavorites(key));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const toggle = useCallback(
    (id: string) => {
      setIds((current) => {
        const next = current.includes(id)
          ? current.filter((other) => other !== id)
          : [id, ...current].slice(0, MAX_FAVORITES);
        writeFavorites(key, next);
        return next;
      });
    },
    [key],
  );

  /** Drops ids the server no longer shows, so the count stays honest. */
  const forget = useCallback(
    (gone: string[]) => {
      if (gone.length === 0) return;
      setIds((current) => {
        const next = current.filter((id) => !gone.includes(id));
        writeFavorites(key, next);
        return next;
      });
    },
    [key],
  );

  const clear = useCallback(() => {
    setIds([]);
    writeFavorites(key, []);
  }, [key]);

  return { ids, toggle, forget, clear };
}
