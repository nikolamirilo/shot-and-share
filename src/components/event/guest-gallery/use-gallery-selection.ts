"use client";

import { useCallback, useState } from "react";

import type { MediaView } from "@/lib/media-view";

/**
 * Which photographs the guest has ticked for download.
 *
 * Press & hold a photo or tap the select button to enter selection mode, then
 * tap photos to add them to the set. Nothing here downloads anything - that is
 * `useZipDownload` - this is only the set and the mode.
 */
export function useGallerySelection() {
  const [selecting, setSelecting] = useState(false);
  const [ids, setIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (item: MediaView) => ids.has(item.id),
    [ids],
  );

  const start = useCallback(() => setSelecting(true), []);

  const clear = useCallback(() => setIds(new Set()), []);

  const exit = useCallback(() => {
    setSelecting(false);
    setIds(new Set());
  }, []);

  return {
    selecting,
    ids,
    count: ids.size,
    isSelected,
    toggle,
    start,
    clear,
    exit,
  };
}
