"use client";

import { useCallback, useState } from "react";

import { type MediaView } from "@/types/media";

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
