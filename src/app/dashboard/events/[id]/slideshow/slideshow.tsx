"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { LogoMark } from "@/components/logo";
import { Hole } from "@/components/ui";
import type { MediaView } from "@/lib/events";
import { createClient } from "@/lib/supabase/browser";

const ADVANCE_MS = 7000;

/**
 * Full-screen slideshow for the venue.
 *
 * One Supabase Realtime channel on `media` for this event is the only live
 * query in the whole product - everything else is a plain request. When a photo
 * lands the channel says so and the page fetches the signed URL, then jumps to
 * it: at a wedding the interesting photo is always the one that just arrived.
 */
export function Slideshow({
  eventId,
  eventName,
  initial,
}: {
  eventId: string;
  eventName: string;
  initial: MediaView[];
}) {
  // Oldest first, so the show reads as the night unfolding.
  const [items, setItems] = useState<MediaView[]>(() => [...initial].reverse());
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState(false);
  const newestRef = useRef<string | null>(initial[0]?.createdAt ?? null);

  const pull = useCallback(async () => {
    const url = new URL(
      `/api/events/${eventId}/latest`,
      window.location.origin,
    );
    if (newestRef.current) url.searchParams.set("since", newestRef.current);

    try {
      const res = await fetch(url);
      const body = await res.json();
      const fresh: MediaView[] = body.items ?? [];
      if (fresh.length === 0) return;

      newestRef.current = fresh[0].createdAt;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const added = [...fresh].reverse().filter((i) => !seen.has(i.id));
        if (added.length === 0) return prev;
        const next = [...prev, ...added];
        // Jump to what just arrived.
        setIndex(next.length - added.length);
        return next;
      });
    } catch {
      /* the next tick will try again */
    }
  }, [eventId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`slideshow:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "media",
          filter: `event_id=eq.${eventId}`,
        },
        () => pull(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    // A venue laptop on hotel wifi will drop the socket at some point, and
    // nobody is watching the console. A slow poll keeps the wall correct.
    const fallback = setInterval(pull, 60_000);

    return () => {
      clearInterval(fallback);
      supabase.removeChannel(channel);
    };
  }, [eventId, pull]);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      ADVANCE_MS,
    );
    return () => clearInterval(timer);
  }, [items.length]);

  const current = items[index];

  return (
    <div className="fixed inset-0 flex flex-col bg-pepper text-butter">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <LogoMark variant="reversed" className="h-7 w-auto" />
          <span className="truncate font-display text-[1.15rem] font-extrabold tracking-[-0.03em] sm:text-[1.3rem]">
            {eventName}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-butter/60">
          <span
            className={`inline-block h-2 w-2 rounded-full ${live ? "bg-gouda" : "bg-butter/30"}`}
          />
          {live ? "live" : "reconnecting"} · {items.length}
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {current ? (
          items.map((item, i) => (
            <div
              key={item.id}
              className="absolute inset-0 flex items-center justify-center p-4 transition-opacity duration-700 sm:p-6"
              style={{ opacity: i === index ? 1 : 0 }}
              aria-hidden={i !== index}
            >
              {item.previewUrl && (
                // The stored copy is 2560px on its longest edge, which is what
                // a projector wants and is already the only copy there is.
                <img
                  src={item.previewUrl}
                  alt=""
                  className="max-h-full max-w-full rounded-2xl object-contain shadow-[0_0_0_4px_var(--color-rind)]"
                />
              )}
            </div>
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex gap-3">
              <Hole size={26} />
              <Hole size={38} />
              <Hole size={20} />
            </div>
            <p className="text-lead text-butter/70">
              Waiting for the first photo.
            </p>
          </div>
        )}
      </div>

      {current?.uploaderName && (
        <p className="px-4 pb-5 text-center font-mono text-[0.8125rem] uppercase tracking-[0.16em] text-butter/60 sm:px-6">
          {current.uploaderName}
        </p>
      )}
    </div>
  );
}
