"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A guest's favourites at one event, kept on their own phone.
 *
 * Local storage and nothing else: a guest has no account, and the point is a
 * shortlist to download at the end of the night, not something the host or
 * anybody else ever sees. Keyed by the share link, so two events on the same
 * phone keep two lists.
 */

const PREFIX = "shot-and-share:favorites:";

/** Enough for any real shortlist, and a bound on what one key can grow to. */
const MAX_FAVORITES = 500;

function read(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private mode or a full disk. The list lasts as long as the page does.
  }
}

/**
 * The list, newest favourite first, and a way to flip one.
 *
 * Starts empty and reads storage after mounting, so the server render and the
 * first client render agree.
 */
export function useFavorites(scope: string) {
  const key = `${PREFIX}${scope}`;
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read(key));
    // Another tab of the same event changed the list.
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setIds(read(key));
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
        write(key, next);
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
        write(key, next);
        return next;
      });
    },
    [key],
  );

  const clear = useCallback(() => {
    setIds([]);
    write(key, []);
  }, [key]);

  return { ids, toggle, forget, clear };
}
