"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Turning the pages of the lightbox with a finger, the way a phone's own photo
 * gallery does it.
 *
 * The photograph follows the finger, with the next one sliding in beside it,
 * and letting go either finishes the turn or springs back. A quick flick
 * counts even when it is short. A tap on the right half of the photograph goes
 * forward and a tap on the left half goes back.
 *
 * The strip is moved by writing its transform straight onto the element, not
 * through React state, so a drag is one style write per frame rather than a
 * render per frame.
 */

/** The space between two photographs on the strip, so they never touch. */
export const SLIDE_GAP_PX = 16;

/**
 * Marks the photograph itself, and the shimmer standing in for it. A tap on
 * one of these turns the page; a tap anywhere else is a tap on the backdrop,
 * and the backdrop closes.
 */
export const PICTURE_ATTR = "data-picture";

/** Below this a moving finger is still a tap. Past it, the direction is decided. */
const SLOP_PX = 10;

/** Held longer than this, it is someone pressing to save the photo, not a tap. */
const TAP_MAX_MS = 500;

/** How far across the window a slow drag has to go before it turns the page. */
const COMMIT_SHARE = 0.25;

/** Faster than this, in px per ms, and a short flick turns the page anyway. */
const FLICK_SPEED = 0.35;

/** Past the first or last photograph the strip stretches rather than moves. */
const EDGE_GIVE = 0.35;

/** The same ease-out the toasts and sheets use. */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const SNAP_BACK_MS = 260;

/** Anything above this is a pinch-zoomed page, not a rounding error. */
const ZOOMED_SCALE = 1.01;

/**
 * Where a drag lands once the finger lifts: the next photo (1), the previous
 * one (-1), or back where it started (0).
 *
 * `offset` is how far the strip has moved, negative towards the next photo.
 * `speed` is the finger's speed at the moment it lifted, in px per ms, with the
 * same sign.
 */
export function landing({
  offset,
  speed,
  width,
  hasPrev,
  hasNext,
}: {
  offset: number;
  speed: number;
  width: number;
  hasPrev: boolean;
  hasNext: boolean;
}): -1 | 0 | 1 {
  const far = width * COMMIT_SHARE;
  if (hasNext && (offset < -far || (speed < -FLICK_SPEED && offset < 0))) {
    return 1;
  }
  if (hasPrev && (offset > far || (speed > FLICK_SPEED && offset > 0))) {
    return -1;
  }
  return 0;
}

/** Which way a tap goes: the right half of the window forward, the left back. */
export function tapDirection(x: number, width: number): -1 | 1 {
  return x >= width / 2 ? 1 : -1;
}

type Sample = { x: number; t: number };

type Gesture = {
  x0: number;
  y0: number;
  t0: number;
  /** Where the strip was when the finger went down. Not always zero - see `onTouchStart`. */
  base: number;
  /** Where the strip is now. */
  offset: number;
  /** Decided once the finger passes the slop, and never changed after that. */
  axis: "x" | "y" | null;
  /** The last two positions, for the speed at the moment of letting go. */
  before: Sample;
  last: Sample;
  /** Started on the photograph, which is the only place a tap turns the page. */
  onPicture: boolean;
};

export function useSwipe({
  track,
  prevId,
  nextId,
  onStep,
  disabled = false,
}: {
  /** The strip holding the photographs, the full width of the window. */
  track: RefObject<HTMLDivElement | null>;
  prevId: string | null;
  nextId: string | null;
  onStep: (id: string) => void;
  /** The report sheet is open: no page turns while a guest picks a reason. */
  disabled?: boolean;
}) {
  const gesture = useRef<Gesture | null>(null);
  /** A turn sliding into place, and the timer that lands it. */
  const settle = useRef<{ id: string; to: number; timer: number } | null>(
    null,
  );

  /*
   * Pinch-zoom is the browser's, and it stays the browser's. While the page
   * is zoomed in, the finger is moving around the photograph, so the strip
   * stops listening and hands every touch back.
   */
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    const view = window.visualViewport;
    if (!view) return;
    const check = () => setZoomed(view.scale > ZOOMED_SCALE);
    check();
    view.addEventListener("resize", check);
    return () => view.removeEventListener("resize", check);
  }, []);

  useEffect(
    () => () => {
      if (settle.current) window.clearTimeout(settle.current.timer);
    },
    [],
  );

  /** Checked when a finger lands, so a drag already under way still finishes. */
  const off = disabled || zoomed;

  function width() {
    return track.current?.clientWidth ?? 0;
  }

  function place(x: number, ms = 0) {
    const el = track.current;
    if (!el) return;
    el.style.transition = ms > 0 ? `transform ${ms}ms ${EASE}` : "none";
    el.style.transform = x === 0 ? "" : `translate3d(${x}px, 0, 0)`;
  }

  /** Where the strip is on screen right now, partway through a slide included. */
  function liveOffset() {
    const el = track.current;
    if (!el) return 0;
    const transform = getComputedStyle(el).transform;
    return transform && transform !== "none"
      ? new DOMMatrixReadOnly(transform).m41
      : 0;
  }

  function stillMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * Show `id` now, with the strip `rest` px from centre.
   *
   * `flushSync` so the photographs swap places in the same frame the strip
   * jumps back under them. Otherwise there is one frame where the old photo
   * is back in the middle, and that frame is the flicker.
   */
  function land(id: string, rest = 0) {
    if (settle.current) window.clearTimeout(settle.current.timer);
    settle.current = null;
    flushSync(() => onStep(id));
    place(rest);
  }

  /** Slide the strip the rest of the way over to `id`, then land on it. */
  function slideTo(id: string, direction: -1 | 1, from: number, speed = 0) {
    if (stillMotion()) {
      land(id);
      return;
    }
    const to = -direction * (width() + SLIDE_GAP_PX);
    // A flick finishes about as fast as it was thrown; a slow drag or a tap
    // takes a short, even glide.
    const ms = Math.round(
      Math.min(320, Math.max(180, Math.abs(to - from) / Math.max(Math.abs(speed), 1.5))),
    );
    place(to, ms);
    const timer = window.setTimeout(() => {
      if (settle.current?.id === id) land(id);
    }, ms);
    settle.current = { id, to, timer };
  }

  function snapBack(from: number) {
    place(0, from === 0 || stillMotion() ? 0 : SNAP_BACK_MS);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (off) return;
    // A second finger is a pinch: let go of the strip and leave it to the browser.
    if (e.touches.length > 1) {
      const g = gesture.current;
      gesture.current = null;
      if (g) snapBack(g.offset);
      return;
    }
    const touch = e.touches[0];
    const target = e.target instanceof Element ? e.target : null;
    // Dragging across a clip is someone scrubbing through it.
    if (!touch || target?.closest("video")) {
      gesture.current = null;
      return;
    }

    /*
     * Caught mid-slide. Rather than jumping to the end, the turn lands where
     * it is and the finger picks the strip up from there, so a quick run of
     * swipes keeps moving instead of stuttering.
     */
    let base = liveOffset();
    const pending = settle.current;
    if (pending) {
      base -= pending.to;
      land(pending.id, base);
    } else {
      place(base);
    }

    const start = { x: touch.clientX, t: e.timeStamp };
    gesture.current = {
      x0: touch.clientX,
      y0: touch.clientY,
      t0: e.timeStamp,
      base,
      offset: base,
      axis: null,
      before: start,
      last: start,
      onPicture: Boolean(target?.closest(`[${PICTURE_ATTR}]`)),
    };
  }

  function onTouchMove(e: React.TouchEvent) {
    const g = gesture.current;
    if (!g) return;
    if (e.touches.length > 1) {
      gesture.current = null;
      snapBack(g.offset);
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - g.x0;
    const dy = touch.clientY - g.y0;
    if (!g.axis) {
      if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return;
      g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (g.axis !== "x") return;

    let x = g.base + dx;
    if ((x > 0 && !prevId) || (x < 0 && !nextId)) x *= EDGE_GIVE;
    g.offset = x;
    g.before = g.last;
    g.last = { x: touch.clientX, t: e.timeStamp };
    place(x);
  }

  function onTouchEnd(e: React.TouchEvent) {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;

    if (g.axis === "x") {
      // A drag is not also a click on whatever it ended over, which on the
      // backdrop would close the lightbox.
      e.preventDefault();
      const dt = g.last.t - g.before.t;
      // The finger stopped before it lifted: that is a placed drag, not a flick.
      const resting = e.timeStamp - g.last.t > 100;
      const speed = dt > 0 && !resting ? (g.last.x - g.before.x) / dt : 0;
      const where = landing({
        offset: g.offset,
        speed,
        width: width(),
        hasPrev: Boolean(prevId),
        hasNext: Boolean(nextId),
      });
      const id = where === 1 ? nextId : where === -1 ? prevId : null;
      if (where !== 0 && id) slideTo(id, where, g.offset, speed);
      else snapBack(g.offset);
      return;
    }

    const touch = e.changedTouches[0];
    const tap =
      g.axis === null && g.onPicture && e.timeStamp - g.t0 < TAP_MAX_MS;
    if (tap && touch) {
      e.preventDefault();
      const direction = tapDirection(touch.clientX, width());
      const id = direction === 1 ? nextId : prevId;
      if (id) slideTo(id, direction, g.offset);
      else snapBack(g.offset);
      return;
    }

    snapBack(g.offset);
  }

  function onTouchCancel() {
    const g = gesture.current;
    gesture.current = null;
    if (g) snapBack(g.offset);
  }

  return {
    /** For the stage: every touch that is not on a control. */
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
    /**
     * `pinch-zoom` keeps the browser's zoom but takes sideways and vertical
     * drags off it, so a swipe never scrolls the page behind the lightbox or
     * collapses the browser's toolbar halfway through. Zoomed in, the browser
     * gets everything back so the guest can move around the photo.
     */
    touchAction: zoomed ? "auto" : "pinch-zoom",
    /** Arrows and keys: straight there, stopping any slide under way. */
    step: (id: string) => land(id),
  } as const;
}
