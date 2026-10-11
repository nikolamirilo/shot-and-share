"use client";

import { useState } from "react";

import { type MediaView } from "@/types/media";
import { COVER_PAGE_SIZE } from "@/lib/media";

export function useCoverPhotos(
  eventId: string,
  firstPage: MediaView[],
  photoCount: number,
) {
  const [photos, setPhotos] = useState(() =>
    firstPage.slice(0, COVER_PAGE_SIZE),
  );
  const [exhausted, setExhausted] = useState(
    () => firstPage.length < COVER_PAGE_SIZE,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
