"use client";

import { cx } from "@/components/ui";

/**
 * What a frame with no photograph in it looks like.
 *
 * Blush and a pulse, which is what the QR code on the host's share panel does
 * while it is being generated. The well the photographs sit in is the darkest
 * surface here, and a frame in it read as a hole in the wall rather than as a
 * photograph on its way.
 */
export const PENDING_SURFACE = "animate-pulse bg-blush";

/**
 * Uneven on purpose. A column of identical rectangles reads as a broken grid;
 * photographs on their way to a masonry wall are all different shapes.
 */
export const PENDING_RATIOS = [0.75, 1, 1.33, 0.8, 1.5, 0.67] as const;

/** `counting(3)` is `[0, 1, 2]`. Keys and sizes both want the index. */
export function counting(n: number): number[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => i);
}

/** The radius of the well this frame stands in for. Kept in step with .recess. */
export function roundedLike(shape: "hole" | "recess") {
  return shape === "hole" ? "rounded-full" : "rounded-[0.625rem]";
}

/**
 * The space a photograph is about to take, before there is a photograph to put
 * in it. From a guest's side of the screen a frame waiting its turn and a page
 * still in flight are one thing - "a photograph is coming here" - so they are
 * drawn the same.
 */
export function Skeleton({
  shape,
  style,
  className,
}: {
  shape: "hole" | "recess";
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx("block", PENDING_SURFACE, roundedLike(shape), className)}
      style={style}
    />
  );
}
