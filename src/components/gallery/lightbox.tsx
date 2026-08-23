"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdOutlineFileDownload,
} from "react-icons/md";

import { ReportButton } from "@/components/gallery/report-button";
import { ON_SCRIM_FLOATING, ON_SCRIM_QUIET, cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";

/** Below this a drag is a tap with a shaky hand, not a swipe. */
const SWIPE_MIN_PX = 50;

export function Lightbox({
  token,
  item,
  prevId,
  nextId,
  position,
  total,
  onStep,
  onClose,
  onReported,
  demo,
}: {
  token: string;
  item: MediaView;
  /** The photo on each side, or null at either end of what has loaded. */
  prevId: string | null;
  nextId: string | null;
  /** Which of the loaded photos this is, counting from one. */
  position: number;
  total: number;
  onStep: (id: string) => void;
  onClose: () => void;
  /**
   * A guest reported this one. The wall drops it and closes behind itself, so
   * the photograph is gone from the screen of the person who objected to it
   * rather than sitting there until the next refresh.
   */
  onReported?: (id: string) => void;
  /**
   * The demo gallery, whose photographs are files in `public` rather than rows
   * in a bucket. There is no signed URL to go and fetch, so the request is
   * skipped rather than fired and allowed to fail.
   */
  demo?: boolean;
}) {
  const [full, setFull] = useState<MediaView | null>(null);
  /**
   * True while the download link is being fetched. Separate from `full` being
   * empty, which after the request means the link is not coming at all.
   */
  const [linkPending, setLinkPending] = useState(true);
  /** False until this photo's pixels are on screen. Reset on every step. */
  const [loaded, setLoaded] = useState(false);
  /** The report sheet is open, which is the one time the arrows are in the way. */
  const [reporting, setReporting] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setLoaded(false);
    setReporting(false);
  }, [item.id]);

  useEffect(() => {
    /*
     * Full-resolution URLs resolve only now, never for a whole page.
     *
     * Clearing first matters: `full` is where Download gets its link, so
     * carrying the old one across a step would offer the previous photo under
     * this one's picture. `live` covers the same hazard from the other side -
     * step twice quickly and the requests can land out of order.
     */
    let live = true;
    setFull(null);

    if (demo) {
      // The file is already the full copy, and it is public.
      setFull({ ...item, downloadUrl: item.fullUrl ?? undefined });
      setLinkPending(false);
      return;
    }

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
  }, [token, item, demo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && prevId) onStep(prevId);
      if (e.key === "ArrowRight" && nextId) onStep(nextId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep, prevId, nextId]);

  // Swipe on photos only: dragging across a video is someone scrubbing.
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
    // Mostly sideways, or it belongs to the page.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;

    const target = dx < 0 ? nextId : prevId;
    if (target) onStep(target);
  }

  // A video waits for the signed URL; a photo shows the full copy through the
  // optimiser, falling back to whatever the grid had if there is not one.
  const viewUrl =
    item.kind === "video" ? full?.url : (item.fullUrl ?? item.previewUrl);

  return (
    <div
      /*
       * `h-[100dvh]` rather than `inset-0` alone. On a phone `inset-0` is the
       * *large* viewport - the window as it would be with the browser's own
       * bars hidden - so the bottom of this sheet spent its life underneath
       * Safari's toolbar, taking whatever was down there with it. The dynamic
       * unit is the window as it actually is right now.
       */
      className="fixed inset-0 z-50 h-[100dvh] overscroll-contain bg-ink/92"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Safe areas on all four sides: the notch at the top, the home
          indicator at the bottom, and the rounded corners in landscape. */}
      <div className="flex h-full w-full items-center justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
        {/*
         * The frame. `h-full` and not `max-h-full`, which is the whole reason
         * the controls used to disappear: a percentage height resolves against
         * a parent that has one, and `max-h-full` leaves this box auto-height,
         * so `max-h-full` on the picture inside it resolved to nothing at all.
         * A portrait photo then rendered at its full height, overflowed the
         * window, and pushed every button out of the bottom of the screen.
         * With a real height here, the picture is bounded by the frame and the
         * frame is bounded by the window.
         */}
        <div
          className="relative flex h-full w-full max-w-2xl items-center justify-center"
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
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full rounded-xl"
              />
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="shimmer aspect-video w-full overflow-hidden rounded-xl bg-well"
              />
            )
          ) : viewUrl ? (
            /*
             * Through the optimiser rather than a bare <img>: `fullUrl` is the
             * full-size copy, a couple of megabytes to fill 672 pixels.
             *
             * The shimmer sits *under* the image and the image is never faded
             * in, so if `onLoad` never fires the photo still shows.
             */
            <>
              {!loaded && (
                <div className="shimmer absolute inset-0 overflow-hidden rounded-xl bg-well" />
              )}
              <Image
                src={viewUrl}
                alt=""
                // A 4:3 guess when we have no real dimensions: it only holds
                // the shimmer's shape until the photo takes over.
                width={item.width ?? 1200}
                height={item.height ?? 900}
                // Full width on a phone, and the frame is max-w-2xl after that.
                sizes="(max-width: 704px) 100vw, 672px"
                onLoad={() => setLoaded(true)}
                onClick={(e) => e.stopPropagation()}
                // The point of the screen, so never lazy.
                priority
                /* Bounded both ways, and `w-auto`/`h-auto` so the aspect ratio
                   survives the bounding: whichever edge runs out first is the
                   one that holds the photograph. */
                className="relative h-auto max-h-full w-auto max-w-full rounded-xl"
              />
            </>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              className="shimmer aspect-square w-full overflow-hidden rounded-xl bg-well"
            />
          )}

          {/* Nothing to step to means one photo in the event, where two dead
              buttons would be furniture. Drawn before the layer below so that
              anything on it - the report sheet especially - covers them rather
              than fighting them for the same strip of screen. */}
          {(prevId || nextId) && !reporting && (
            <>
              <StepArrow direction="prev" targetId={prevId} onStep={onStep} />
              <StepArrow direction="next" targetId={nextId} onStep={onStep} />
            </>
          )}

          {/*
           * Every control is laid *on* the picture rather than in a row under
           * it. A row under it is only reachable when the picture leaves room,
           * and on a phone in portrait it never does.
           *
           * The layer itself takes no clicks - a tap beside the photograph
           * still closes, and a swipe still steps - so each control turns them
           * back on for itself.
           */}
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-2 sm:p-3">
            <div className="flex items-start justify-between gap-2">
              {total > 1 ? (
                <span
                  className={cx(
                    "rounded-full px-3 py-1.5 font-mono text-micro uppercase tracking-[0.16em]",
                    ON_SCRIM_QUIET,
                  )}
                >
                  {position} of {total}
                </span>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                title="Close"
                className={cx(
                  "pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform hover:scale-105",
                  ON_SCRIM_FLOATING,
                )}
              >
                <MdClose aria-hidden className="h-6 w-6" />
              </button>
            </div>

            {/* Above the video's own controls rather than across the scrub
                bar, which is the one strip of a video that has to stay free. */}
            <div
              className={cx(
                "flex min-h-0 flex-col items-center gap-2 overflow-y-auto",
                item.kind === "video" && "pb-12",
              )}
            >
              {item.processing && (
                <p
                  className={cx(
                    "rounded-xl px-3 py-2 text-center text-label",
                    ON_SCRIM_QUIET,
                  )}
                >
                  Still being converted so it plays everywhere. Check back
                  shortly.
                </p>
              )}

              <div
                className="pointer-events-auto flex w-full max-w-sm flex-wrap items-center justify-center gap-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                {/* One anchor in two states rather than one that appears when
                    the link lands: stepping re-fetches, and a button that
                    vanishes and returns moves the one beside it every time.
                    Absent entirely once the request finishes with no link,
                    since there is nothing to wait for. */}
                {(linkPending || full?.downloadUrl) && (
                  <a
                    href={full?.downloadUrl}
                    download={full?.downloadUrl ? true : undefined}
                    aria-disabled={full?.downloadUrl ? undefined : true}
                    className={cx(
                      "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-small font-semibold leading-tight",
                      ON_SCRIM_FLOATING,
                      !full?.downloadUrl && "opacity-45",
                    )}
                  >
                    <MdOutlineFileDownload
                      aria-hidden
                      className="shrink-0 text-[1.25em]"
                    />
                    Download
                  </a>
                )}
                {onReported && (
                  <ReportButton
                    token={token}
                    mediaId={item.id}
                    onReported={() => onReported(item.id)}
                    onOpenChange={setReporting}
                  />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/**
 * One of the two arrows. A null target is the end of what has loaded: the
 * button stays put and greys out, because one that disappeared would move the
 * other and shift the photo underneath.
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
      /* The backdrop closes on click and this button sits on top of it, so the
         step has to stop where it happened or every step is also a close. */
      onClick={(e) => {
        e.stopPropagation();
        if (targetId) onStep(targetId);
      }}
      aria-label={back ? "Previous photo" : "Next photo"}
      className={cx(
        /*
         * A plain half. It used to be `min(50%, 35vh)`, because a portrait
         * photo laid out at full width ran off the bottom of the screen and
         * took its own middle with it. The picture is bounded by the window
         * now, so half of it is always somewhere a thumb can reach.
         */
        `absolute top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-45 ${ON_SCRIM_FLOATING}`,
        back ? "left-2" : "right-2",
      )}
    >
      {back ? (
        <MdChevronLeft aria-hidden className="h-7 w-7" />
      ) : (
        <MdChevronRight aria-hidden className="h-7 w-7" />
      )}
    </button>
  );
}
