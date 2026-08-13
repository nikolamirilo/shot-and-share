"use client";

import { useCallback, useEffect, useState } from "react";

import type { MediaView } from "@/lib/media-view";

/**
 * How many photographs are allowed to start loading at once.
 *
 * Handing the browser fifty images and letting it decide is what made the wall
 * fill in at random: they all start together and finish in whatever order their
 * file sizes and the venue's wifi settle on. Ten at a time, in order, means the
 * wall fills from the top down and the guest sees the newest photographs first.
 */
const LOAD_WAVE = 10;

/**
 * How long a wave gets before the next one goes anyway. One photograph that
 * never arrives must not hold the rest of the evening behind it.
 */
const WAVE_TIMEOUT_MS = 6000;

/**
 * Which photographs are allowed to ask the network for anything yet.
 *
 * A photograph is "settled" when it has loaded or failed; a wave is over when
 * all of its photographs have settled, and then the next ten go. Anything with
 * no preview at all is never waited on - it has nothing to fetch.
 */
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

    // Restarted by every photograph that lands, so this is six seconds of no
    // progress at all rather than six seconds per wave.
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
