"use client";

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

import { LogoMark } from "@/components/layout/logo";
import { Hole, Photo, cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";
import { createClient } from "@/lib/supabase/browser";

const ADVANCE_MS = 7000;

/**
 * How often the page asks for itself when nothing has nudged it.
 *
 * Two speeds, because the poll means two different things. Beside a live socket
 * it is a safety net and a minute is plenty. With the socket down it *is* the
 * slideshow, and a wedding guest who uploads a photo should not watch a blank
 * minute go by before it appears.
 */
const POLL_LIVE_MS = 60_000;
const POLL_OFFLINE_MS = 10_000;

/** Pointer still this long and the furniture goes. It is pointed at a wall. */
const IDLE_MS = 3_000;

/**
 * A stop on the walk back through the event, at 200 photographs a page: forty
 * thousand of them, which no wedding has. It is here so a cursor that stopped
 * moving cannot turn into a loop nobody notices until the laptop is warm.
 */
const MAX_BACKFILL_PAGES = 200;

/**
 * What the projector draws for one item.
 *
 * The full copy rather than `previewUrl`: that is a 640px thumbnail cut for
 * grid tiles (see THUMB_MAX_EDGE) and it is visibly soft blown up across a
 * 1080p wall. A clip has no full copy and falls back to its poster frame.
 */
function frameUrl(item: MediaView): string | null {
  return item.fullUrl ?? item.previewUrl;
}

/**
 * Only what can actually be drawn.
 *
 * A photo still waiting on the worker - a HEIC from desktop Chrome, a clip
 * with no poster yet - has no URL at all, and left in the list it is seven
 * seconds of black screen in the middle of the party. It comes back on a later
 * poll with its rendition attached.
 */
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

/**
 * Full-screen slideshow for the venue.
 *
 * One Supabase Realtime channel on `media` for this event is the only live
 * query in the whole product - everything else is a plain request. When a photo
 * lands the channel says so and the page fetches the signed URL, then jumps to
 * it: at a wedding the interesting photo is always the one that just arrived.
 *
 * It renders no navigation of its own beyond the strip at the top, which fades
 * out when the room stops touching the laptop. The route sits outside the
 * dashboard's `(shell)` group for the same reason.
 */
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
  /**
   * Where the rest of the evening starts. The server sends a page rather than
   * the whole event so the wall lights up straight away; this is the cursor the
   * browser walks back through to fetch everything before it. Null when the
   * seed already is the whole event.
   */
  olderThan: string | null;
}) {
  // Oldest first, so the show reads as the night unfolding.
  const [items, setItems] = useState<MediaView[]>(() =>
    showable(initial).reverse(),
  );
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);

  /*
   * Both seeded from the first render's list - `useRef` ignores every later
   * argument - and both deliberately count only what is on the wall.
   *
   * The cursor is the newest photograph we can *draw*, not the newest row.
   * Moving it past one that is still converting would drop that photograph for
   * good: its timestamp never changes, so the next poll would ask for rows
   * after it and never see it again. `seen` follows the same rule, or the poll
   * that finally brings back a converted photo would discard it as a duplicate
   * of the blank it replaces.
   *
   * They sit here rather than inside the state updater because an updater that
   * writes to a ref runs twice under StrictMode.
   */
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
      // Newest first off the wire; the wall runs the other way.
      const added = [...fresh]
        .reverse()
        .filter((item) => !seenRef.current.has(item.id));
      if (added.length === 0) return;

      for (const item of added) seenRef.current.add(item.id);
      setItems((prev) => [...prev, ...added]);
      jumpRef.current = true;
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, pull]);

  // A venue laptop on hotel wifi will drop the socket at some point, and nobody
  // is watching the console.
  useEffect(() => {
    const timer = setInterval(pull, live ? POLL_LIVE_MS : POLL_OFFLINE_MS);
    return () => clearInterval(timer);
  }, [live, pull]);

  /*
   * The rest of the evening, walked backwards from the seed.
   *
   * The whole event rather than a page of it: a slideshow that holds the last
   * sixty photographs is a slideshow of the last ten minutes, and the guest
   * looking for the one they took before dinner never sees it. Three hundred
   * photographs is two requests, and the browser holds a list of URLs - only
   * three of them are ever in the DOM.
   *
   * Each page goes on the front, so the wall stays in order, and the index
   * moves with it: whoever is watching should not have the photograph swapped
   * out from under them because a page landed.
   */
  useEffect(() => {
    if (!olderThan) return;
    let live = true;

    (async () => {
      let cursor: string | null = olderThan;
      for (let page = 0; live && cursor && page < MAX_BACKFILL_PAGES; page++) {
        const url = new URL(
          `/api/events/${eventId}/latest`,
          window.location.origin,
        );
        url.searchParams.set("before", cursor);

        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const body = await res.json();
          // The cursor counts rows, not slides: it has to step over a
          // photograph that is still converting rather than stall on it.
          cursor = body.nextCursor ?? null;

          const older = showable(body.items ?? []).filter(
            (item: MediaView) => !seenRef.current.has(item.id),
          );
          if (older.length === 0) continue;

          for (const item of older) seenRef.current.add(item.id);
          const earlier = older.reverse();
          setItems((prev) => [...earlier, ...prev]);
          setIndex((i) => i + earlier.length);
        } catch {
          // The wall keeps running on what it already has.
          return;
        }
      }
    })();

    return () => {
      live = false;
    };
  }, [eventId, olderThan]);

  // Jump to what just arrived. Separate from the merge so the state updater
  // stays a pure function of the previous list.
  useEffect(() => {
    if (!jumpRef.current) return;
    jumpRef.current = false;
    // Paused is somebody holding one photograph up on purpose. A new arrival
    // does not get to take the wall off them.
    if (!paused) setIndex(items.length - 1);
  }, [items, paused]);

  // Read by the timer below when it fires rather than when it is set, so that
  // a backfill page landing mid-slide does not restart the clock.
  const countRef = useRef(items.length);
  useEffect(() => {
    countRef.current = items.length;
  }, [items.length]);

  /*
   * Keyed on the photograph rather than its position, so every slide gets its
   * full seven seconds. It used to be keyed on nothing at all: a photo jumped
   * to a moment before the interval was due flashed past in whatever was left
   * of the tick. Position alone would restart the clock every time the backfill
   * shifted it, which is the same photograph and should not buy more time.
   *
   * `tooFew` rather than the length: below two slides there is nothing to
   * advance to, and this is what starts the show when the second one lands.
   */
  const currentId = items[index]?.id;
  const tooFew = items.length < 2;
  useEffect(() => {
    if (paused || tooFew) return;
    const timer = setTimeout(
      () => setIndex((i) => (i + 1) % countRef.current),
      ADVANCE_MS,
    );
    return () => clearTimeout(timer);
  }, [paused, currentId, tooFew]);

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

  // The button follows the browser rather than its own memory: Escape and F11
  // leave full screen without going through it.
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

  // The laptop is across the room and nobody is going to find a button on it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === " ") {
        // Or the browser scrolls a page that has nowhere to scroll to.
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
      {/* Furniture, not part of the show: it fades out with the pointer and
          takes its clicks with it, so a still room sees only photographs. */}
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
            // Only the current slide and its neighbours: the stored object is
            // the full photo, so sixty in the DOM is tens of megabytes on venue
            // wifi and fifty-eight are invisible. The neighbours stay so the
            // crossfade has something to fade from.
            const gap = Math.abs(i - index);
            if (gap > 1 && gap < items.length - 1) return null;

            return (
              <div
                key={item.id}
                className="absolute inset-0 flex items-center justify-center p-4 transition-opacity duration-700 sm:p-6"
                style={{ opacity: i === index ? 1 : 0 }}
                aria-hidden={i !== index}
              >
                {/* Resized to the screen rather than the stored original: a
                    projector is 1080p and the optimiser caches the result. */}
                <Photo
                  src={frameUrl(item) as string}
                  alt=""
                  width={item.width ?? 1600}
                  height={item.height ?? 1200}
                  sizes="100vw"
                  priority={i === index}
                  // A soft halo rather than a cast shadow, which would not
                  // show against the near-black room.
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
