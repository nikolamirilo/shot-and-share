"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export const SLIDE_GAP_PX = 16;

export const PICTURE_ATTR = "data-picture";

const SLOP_PX = 10;

const TAP_MAX_MS = 500;

const COMMIT_SHARE = 0.25;

const FLICK_SPEED = 0.35;

const EDGE_GIVE = 0.35;

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const SNAP_BACK_MS = 260;

const ZOOMED_SCALE = 1.01;

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

export function tapDirection(x: number, width: number): -1 | 1 {
  return x >= width / 2 ? 1 : -1;
}

type Sample = { x: number; t: number };

type Gesture = {
  x0: number;
  y0: number;
  t0: number;
  base: number;
  offset: number;
  axis: "x" | "y" | null;
  before: Sample;
  last: Sample;
  onPicture: boolean;
};

export function useSwipe({
  track,
  prevId,
  nextId,
  onStep,
  disabled = false,
}: {
  track: RefObject<HTMLDivElement | null>;
  prevId: string | null;
  nextId: string | null;
  onStep: (id: string) => void;
  disabled?: boolean;
}) {
  const gesture = useRef<Gesture | null>(null);
  const settle = useRef<{ id: string; to: number; timer: number } | null>(
    null,
  );

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

  function land(id: string, rest = 0) {
    if (settle.current) window.clearTimeout(settle.current.timer);
    settle.current = null;
    flushSync(() => onStep(id));
    place(rest);
  }

  function slideTo(id: string, direction: -1 | 1, from: number, speed = 0) {
    if (stillMotion()) {
      land(id);
      return;
    }
    const to = -direction * (width() + SLIDE_GAP_PX);
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
    if (e.touches.length > 1) {
      const g = gesture.current;
      gesture.current = null;
      if (g) snapBack(g.offset);
      return;
    }
    const touch = e.touches[0];
    const target = e.target instanceof Element ? e.target : null;
    if (!touch || target?.closest("video")) {
      gesture.current = null;
      return;
    }

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
      e.preventDefault();
      const dt = g.last.t - g.before.t;
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
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
    touchAction: zoomed ? "auto" : "pinch-zoom",
    step: (id: string) => land(id),
  } as const;
}
