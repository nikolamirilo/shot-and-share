"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";

import { cx } from "@/lib/cx";

/**
 * One of the brand's drawings, moving.
 *
 * The JSON in ./lottie is generated from the same coordinates as the logo and
 * the step drawings (scripts/build-lottie.js), so an animation and its still
 * are the same object. The still is passed as `children` and is what renders
 * on the server, without JavaScript, and for anybody who prefers reduced
 * motion: the player only replaces it once it has drawn a frame.
 *
 * The player itself (lottie-web's light build, SVG only) is imported on first
 * use, so it never sits in front of the hero's first paint. Loops pause when
 * they leave the screen; a `once` animation plays the first time it is seen.
 */

export interface LottieHandle {
  /** Play from the start, whatever it was doing. */
  replay: () => void;
}

type AnimationData = { op: number } & Record<string, unknown>;

export function LottiePlayer({
  data,
  rest,
  once = false,
  manual = false,
  className,
  children,
  ref,
}: {
  data: AnimationData;
  /** The frame shown when still: a complete picture, not an empty one. */
  rest?: number;
  once?: boolean;
  /** Never starts itself; the caller plays it through `ref`. */
  manual?: boolean;
  className?: string;
  /** The static drawing, until the animation has a frame of its own. */
  children?: React.ReactNode;
  ref?: React.Ref<LottieHandle>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const anim = useRef<import("lottie-web").AnimationItem | null>(null);
  const [ready, setReady] = useState(false);
  const restFrame = rest ?? data.op - 1;

  useImperativeHandle(ref, () => ({
    replay: () => {
      if (reducedMotion()) return;
      anim.current?.goToAndPlay(0, true);
    },
  }));

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let played = false;

    import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelled) return;
      const item = lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: !once,
        autoplay: false,
        // lottie-web writes caches into the object it is given.
        animationData: structuredClone(data),
        rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
      });
      anim.current = item;
      item.goToAndStop(restFrame, true);
      setReady(true);
      if (manual) return;

      observer = new IntersectionObserver(
        ([entry]) => {
          if (reducedMotion()) return;
          if (entry.isIntersecting) {
            if (!once) item.play();
            else if (!played) {
              played = true;
              item.goToAndPlay(0, true);
            }
          } else if (!once) {
            item.pause();
          }
        },
        { threshold: 0.35 },
      );
      observer.observe(el);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      anim.current?.destroy();
      anim.current = null;
    };
  }, [data, once, manual, restFrame]);

  return (
    <div className={cx("relative", className)} aria-hidden>
      <div ref={box} className="absolute inset-0 [&>svg]:block" />
      {!ready && children}
    </div>
  );
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
