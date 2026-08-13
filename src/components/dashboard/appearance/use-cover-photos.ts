"use client";

import { useState } from "react";

import type { MediaView } from "@/lib/media-view";
import { COVER_PAGE_SIZE } from "@/lib/media";

/**
 * The event's photographs, a page at a time.
 *
 * The picker used to show whatever the console had already loaded, cut to the
 * first two dozen: a host whose cover shot was taken on the second night could
 * not reach it at all. This pages through the lot on the same keyset cursor the
 * guest gallery uses.
 */
export function useCoverPhotos(
  eventId: string,
  firstPage: MediaView[],
  photoCount: number,
) {
  // The console already loaded these, so the first page costs no request.
  const [photos, setPhotos] = useState(() =>
    firstPage.slice(0, COVER_PAGE_SIZE),
  );
  const [exhausted, setExhausted] = useState(
    () => firstPage.length < COVER_PAGE_SIZE,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Both halves have to agree before another page is offered: the count is what
  // the database says exists, and `exhausted` is what the last request actually
  // returned. A photo deleted mid-browse makes the first one optimistic.
  const more = !exhausted && photos.length < photoCount;

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

  return { photos, more, loading, loadMore, error, setError };
}
