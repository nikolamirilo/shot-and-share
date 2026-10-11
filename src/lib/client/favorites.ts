/**
 * A guest's favourites at one event, kept on their own phone.
 *
 * Local storage and nothing else: a guest has no account, and the point is a
 * shortlist to download at the end of the night, not something the host or
 * anybody else ever sees. Keyed by the share link, so two events on the same
 * phone keep two lists.
 *
 * The React side lives in @/hooks/useFavorites; this is just the storage.
 */

import { FAVORITES_PREFIX } from "@/constants/storage-keys";

/** Enough for any real shortlist, and a bound on what one key can grow to. */
export const MAX_FAVORITES = 500;

export function favoritesKey(scope: string): string {
  return `${FAVORITES_PREFIX}${scope}`;
}

export function readFavorites(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeFavorites(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private mode or a full disk. The list lasts as long as the page does.
  }
}
