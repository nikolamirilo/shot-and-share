"use client";

import { LOAD_WAVE, WAVE_TIMEOUT_MS } from "@/constants/gallery";

import { useCallback, useEffect, useState } from "react";

import { type MediaView } from "@/types/media";



export function useLoadQueue(items: MediaView[]) {
  const [released, setReleased] = useState(LOAD_WAVE);
  const [settled, setSettled] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const waiting = items
    .slice(0, released)
    .filter((item) => item.previewUrl && !settled.has(item.id)).length;

  useEffect(() => {
    if (released >= items.length) return;
    if (waiting === 0) {
      setReleased((count) => count + LOAD_WAVE);
      return;
    }

    const timer = setTimeout(
      () => setReleased((count) => count + LOAD_WAVE),
      WAVE_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [waiting, released, items.length]);

  const settle = useCallback((id: string) => {
    setSettled((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  return { held: (index: number) => index >= released, settle };
}
