"use client";

import {
  ADVANCE_MS,
  IDLE_MS,
  MAX_BACKFILL_PAGES,
  POLL_LIVE_MS,
  POLL_OFFLINE_MS,
} from "@/constants/slideshow";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdFullscreen,
  MdFullscreenExit,
  MdPause,
  MdPlayArrow,
} from "react-icons/md";

import { LogoMark } from "@/components/layout/Logo";
import { Hole, Photo, cx } from "@/components/ui";
import { type MediaView } from "@/types/media";
import { createClient } from "@/lib/supabase/browser";





function frameUrl(item: MediaView): string | null {
  return item.fullUrl;
}

/** A photo still waiting on the worker has no full copy, so it is skipped. */
function showable(items: MediaView[]): MediaView[] {
  return items.filter((item) => frameUrl(item) !== null);
}

function requestFullscreen(el: HTMLElement) {
  const webkit = el as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (el.requestFullscreen) {
    return void el.requestFullscreen().catch(() => {});
  }
  webkit.webkitRequestFullscreen?.();
}

function exitFullscreen() {
  const webkit = document as Document & { webkitExitFullscreen?: () => void };
  if (document.exitFullscreen) {
    return void document.exitFullscreen().catch(() => {});
  }
  webkit.webkitExitFullscreen?.();
}

export function Slideshow({
  eventId,
  eventName,
  backHref,
  initial,
  olderThan,
}: {
  eventId: string;
  eventName: string;
  backHref: string;
  initial: MediaView[];
  olderThan: string | null;
}) {
  const [items, setItems] = useState<MediaView[]>(() =>
    showable(initial).reverse(),
  );
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [backfilling, setBackfilling] = useState(olderThan !== null);

  const newestRef = useRef<string | null>(
    items[items.length - 1]?.createdAt ?? null,
  );
  const seenRef = useRef(new Set(items.map((item) => item.id)));
  const jumpRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pull = useCallback(async () => {
    const url = new URL(
      `/api/events/${eventId}/latest`,
      window.location.origin,
    );
    if (newestRef.current) url.searchParams.set("since", newestRef.current);

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const body = await res.json();
      const fresh = showable(body.items ?? []);
      if (fresh.length === 0) return;

      newestRef.current = fresh[0].createdAt;
      const added = [...fresh]
        .reverse()
        .filter((item) => !seenRef.current.has(item.id));
      if (added.length === 0) return;

      for (const item of added) seenRef.current.add(item.id);
      setItems((prev) => [...prev, ...added]);
      jumpRef.current = true;
    } catch {
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, pull]);

  useEffect(() => {
    const timer = setInterval(pull, live ? POLL_LIVE_MS : POLL_OFFLINE_MS);
    return () => clearInterval(timer);
  }, [live, pull]);

  useEffect(() => {
    if (!olderThan) return;
    let live = true;

    (async () => {
      try {
        let cursor: string | null = olderThan;
        let page = 0;
        while (live && cursor && page++ < MAX_BACKFILL_PAGES) {
          const url = new URL(
            `/api/events/${eventId}/latest`,
            window.location.origin,
          );
          url.searchParams.set("before", cursor);

          const res = await fetch(url);
          if (!res.ok) return;
          const body = await res.json();
          if (!live) return;
          cursor = body.nextCursor ?? null;

          const older = showable(body.items ?? []).filter(
            (item: MediaView) => !seenRef.current.has(item.id),
          );
          if (older.length === 0) continue;

          for (const item of older) seenRef.current.add(item.id);
          const earlier = older.reverse();
          setItems((prev) => [...earlier, ...prev]);
          setIndex((i) => (i === 0 ? 0 : i + earlier.length));
        }
      } catch {
      } finally {
        if (live) setBackfilling(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [eventId, olderThan]);

  useEffect(() => {
    if (!jumpRef.current) return;
    jumpRef.current = false;
    if (!paused) setIndex(items.length - 1);
  }, [items, paused]);

  const countRef = useRef(items.length);
  useEffect(() => {
    countRef.current = items.length;
  }, [items.length]);

  const currentId = items[index]?.id;
  const tooFew = items.length < 2;
  useEffect(() => {
    if (paused || tooFew || backfilling) return;
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % countRef.current),
      ADVANCE_MS,
    );
    return () => clearTimeout(timer);
  }, [paused, currentId, tooFew, backfilling]);

  const wake = useCallback(() => {
    setIdle(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS);
  }, []);

  useEffect(() => {
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [wake]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) exitFullscreen();
    else requestFullscreen(document.documentElement);
  }, []);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const count = items.length;
  const step = useCallback(
    (delta: number) =>
      setIndex((i) => (count === 0 ? 0 : (i + delta + count) % count)),
    [count],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "f" || e.key === "F") toggleFullscreen();
      else return;
      wake();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, toggleFullscreen, wake]);

  const current = items[index];
  const control =
    "grid h-9 w-9 place-items-center rounded-full bg-linen/10 text-linen transition-colors hover:bg-linen/20 disabled:opacity-30 disabled:hover:bg-linen/10";

  return (
    <div
      className={cx(
        "fixed inset-0 z-50 flex flex-col bg-ink text-linen",
        idle && "cursor-none",
      )}
    >
      <div
        className={cx(
          "flex items-center justify-between gap-3 px-4 py-3 transition-opacity duration-500 sm:px-6 sm:py-4",
          idle ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <LogoMark variant="reversed" className="h-7 w-auto" />
          <span className="truncate font-display text-[1.15rem] font-extrabold tracking-[-0.03em] sm:text-[1.3rem]">
            {eventName}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-linen/60">
          <span
            className={cx(
              "inline-block h-2 w-2 rounded-full",
              live ? "bg-rose" : "bg-linen/30",
            )}
          />
          <span className="hidden sm:inline">
            {live ? "live" : "reconnecting"} ·{" "}
          </span>
          {count > 0 ? `${index + 1} / ${count}` : count}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={count < 2}
            aria-label="Previous photo"
            title="Previous photo (left arrow)"
            className={control}
          >
            <MdChevronLeft aria-hidden className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            disabled={count < 2}
            aria-label={paused ? "Resume" : "Pause"}
            title={paused ? "Resume (space)" : "Pause (space)"}
            className={control}
          >
            {paused ? (
              <MdPlayArrow aria-hidden className="h-5 w-5" />
            ) : (
              <MdPause aria-hidden className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={count < 2}
            aria-label="Next photo"
            title="Next photo (right arrow)"
            className={control}
          >
            <MdChevronRight aria-hidden className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Leave full screen" : "Go full screen"}
            title={fullscreen ? "Leave full screen (f)" : "Go full screen (f)"}
            className={control}
          >
            {fullscreen ? (
              <MdFullscreenExit aria-hidden className="h-5 w-5" />
            ) : (
              <MdFullscreen aria-hidden className="h-5 w-5" />
            )}
          </button>
          <Link
            href={backHref}
            aria-label="Back to the event"
            title="Back to the event"
            className={control}
          >
            <MdClose aria-hidden className="h-5 w-5" />
          </Link>
        </span>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {current ? (
          items.map((item, i) => {
            const gap = Math.abs(i - index);
            if (gap > 1 && gap < items.length - 1) return null;

            return (
              <div
                key={item.id}
                className="absolute inset-0 flex items-center justify-center p-4 transition-opacity duration-700 sm:p-6"
                style={{ opacity: i === index ? 1 : 0 }}
                aria-hidden={i !== index}
              >
                <Photo
                  src={frameUrl(item) as string}
                  alt=""
                  width={item.width ?? 1600}
                  height={item.height ?? 1200}
                  sizes="100vw"
                  priority={i === index}
                  className="h-auto max-h-full w-auto max-w-full rounded-2xl object-contain shadow-[0_0_36px_rgba(0,0,0,0.55)]"
                />
              </div>
            );
          })
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="flex gap-3">
              <Hole size={26} />
              <Hole size={38} />
              <Hole size={20} />
            </div>
            <p className="text-lead text-linen/70">
              Waiting for the first photo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
