"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button, cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";

/** Below this a drag is a tap with a shaky hand, not a swipe. */
const SWIPE_MIN_PX = 50;

export function Lightbox({
  token,
  item,
  mine,
  prevId,
  nextId,
  position,
  total,
  onStep,
  onClose,
  onRemove,
}: {
  token: string;
  item: MediaView;
  mine: boolean;
  /** The photo on each side, or null at either end of what has loaded. */
  prevId: string | null;
  nextId: string | null;
  /** Which of the loaded photos this is, counting from one. */
  position: number;
  total: number;
  onStep: (id: string) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const [full, setFull] = useState<MediaView | null>(null);
  /**
   * True while this photo's download link is being fetched. Separate from
   * `full` being empty, which after the request has finished means the link
   * genuinely is not coming.
   */
  const [linkPending, setLinkPending] = useState(true);
  /** False until this photo's pixels are on screen. Reset on every step. */
  const [loaded, setLoaded] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setLoaded(false), [item.id]);

  useEffect(() => {
    /*
     * Full-resolution URLs resolve only now, never for a whole page.
     *
     * Clearing first matters once the arrows exist: `full` is where the
     * Download button gets its link, so carrying the old one across a step
     * would offer the previous photo under this one's picture. `live` covers
     * the same hazard from the other side - step twice quickly and the two
     * requests can land out of order.
     */
    let live = true;
    setFull(null);
    setLinkPending(true);
    const params = new URLSearchParams({ token, id: item.id });
    fetch(`/api/photo?${params}`)
      .then((r) => r.json())
      .then((data) => live && setFull(data?.id ? data : null))
      .catch(() => live && setFull(null))
      .finally(() => live && setLinkPending(false));
    return () => {
      live = false;
    };
  }, [token, item.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && prevId) onStep(prevId);
      if (e.key === "ArrowRight" && nextId) onStep(nextId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep, prevId, nextId]);

  /*
   * Swipe, on photos only. A video gets the gesture instead - dragging across
   * one is someone scrubbing, and stealing that to change photo would make the
   * controls feel broken.
   */
  function onTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    const touch = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Mostly sideways, or it belongs to the page: a tall photo in a scrolling
    // panel is dragged up and down far more often than across.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;

    const target = dx < 0 ? nextId : prevId;
    if (target) onStep(target);
  }

  /*
   * A video waits for the signed URL, because the poster is not the clip. A
   * photo has its URL from the moment the grid loaded - what it waits for is
   * the bytes, which is a different wait and is handled below.
   */
  const viewUrl = item.kind === "video" ? full?.url : item.previewUrl;

  return (
    <div
      /* Safe-area padding at the bottom: on a phone the home indicator sits
         exactly where the Close button lands. */
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-ink/92 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative"
          onTouchStart={item.kind === "video" ? undefined : onTouchStart}
          onTouchEnd={item.kind === "video" ? undefined : onTouchEnd}
        >
          {item.kind === "video" ? (
            viewUrl ? (
              <video
                src={viewUrl}
                poster={item.posterUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-xl"
              />
            ) : (
              <div className="shimmer relative aspect-video w-full overflow-hidden rounded-xl bg-well" />
            )
          ) : viewUrl ? (
            /*
             * Through the optimiser, like the grid, rather than a bare <img>.
             * `previewUrl` is the stored original - a phone camera's four-odd
             * megabytes - and pointing an <img> at it downloaded all of them to
             * fill 672 pixels of screen. It is the same photo either way; the
             * difference is a second of staring at nothing on venue wifi.
             *
             * The shimmer behind it is what fills that second. It sits under
             * the image rather than over it, and the image is never faded in:
             * if `onLoad` somehow never fires, the photo still shows and the
             * only cost is an animation nobody can see.
             */
            <>
              {!loaded && (
                <div className="shimmer absolute inset-0 overflow-hidden rounded-xl bg-well" />
              )}
              <Image
                src={viewUrl}
                alt=""
                // Real dimensions when we have them, a 4:3 guess when we do
                // not: it only has to hold the shimmer's shape until the photo
                // lands and takes over the height itself.
                width={item.width ?? 1200}
                height={item.height ?? 900}
                // Full width on a phone, and the panel is max-w-2xl after that.
                sizes="(max-width: 704px) 100vw, 672px"
                onLoad={() => setLoaded(true)}
                // This photo is the only reason the guest tapped. It is not a
                // candidate for lazy loading - it is the point of the screen.
                priority
                className="relative h-auto w-full rounded-xl"
              />
            </>
          ) : (
            <div className="shimmer relative aspect-square w-full overflow-hidden rounded-xl bg-well" />
          )}

          {/* Nothing to step to at all means one photo in the event: two dead
              buttons over it would be furniture. With a wall to move through
              they both stay put and grey out at the ends, so the picture never
              shifts under a finger that is tapping the same spot. */}
          {(prevId || nextId) && (
            <>
              <StepArrow direction="prev" targetId={prevId} onStep={onStep} />
              <StepArrow direction="next" targetId={nextId} onStep={onStep} />
            </>
          )}
        </div>

        {total > 1 && (
          <p className="mt-3 text-center font-mono text-micro uppercase tracking-[0.16em] text-linen/70">
            {position} of {total}
          </p>
        )}

        {item.processing && (
          <p className="mt-3 rounded-xl bg-linen/12 px-3 py-2 text-center text-label text-linen/80">
            Still being converted so it plays everywhere. Check back shortly.
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2.5 sm:gap-3">
          <Button onClick={onClose} variant="onDark" size="sm">
            Close
          </Button>
          {/*
            * One anchor in two states rather than appearing when the link
            * lands. Stepping between photos re-fetches the link, and a button
            * that vanishes and comes back moves the two beside it every time -
            * so it holds its place and goes dim instead. Without `href` it is
            * inert and out of the tab order already; `aria-disabled` says so
            * out loud.
            *
            * It is still absent entirely when the request has finished and
            * brought back no link, because then there is nothing to wait for.
            */}
          {(linkPending || full?.downloadUrl) && (
            <a
              href={full?.downloadUrl}
              download={full?.downloadUrl ? true : undefined}
              aria-disabled={full?.downloadUrl ? undefined : true}
              className={cx(
                "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-chalk px-3.5 py-2 text-small font-semibold leading-tight text-ink",
                !full?.downloadUrl && "opacity-45",
              )}
            >
              Download
            </a>
          )}
          {mine && (
            <Button onClick={onRemove} variant="onDark" size="sm">
              Remove mine
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One of the two arrows over the open photo. A null target is the end of what
 * has loaded: the button stays where it is and goes grey, because an arrow that
 * disappeared would move the other one and shift the photo underneath.
 */
function StepArrow({
  direction,
  targetId,
  onStep,
}: {
  direction: "prev" | "next";
  targetId: string | null;
  onStep: (id: string) => void;
}) {
  const back = direction === "prev";
  return (
    <button
      type="button"
      disabled={!targetId}
      onClick={() => targetId && onStep(targetId)}
      aria-label={back ? "Previous photo" : "Next photo"}
      className={cx(
        /*
         * `min(50%, 35vh)` rather than a plain half: a tall portrait photo is
         * taller than the window and the panel scrolls, so its true middle can
         * sit below the fold - an arrow you have to scroll to find. Short
         * photos still get the middle, tall ones get a point near the top that
         * is on screen the moment the lightbox opens.
         */
        // Dimmed the same way every other disabled control in the app is.
        "absolute top-[min(50%,35vh)] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-chalk text-ink transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-45",
        back ? "left-2" : "right-2",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        role="presentation"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={back ? "M15 4 7 12l8 8" : "M9 4l8 8-8 8"} />
      </svg>
    </button>
  );
}
