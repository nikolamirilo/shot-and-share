"use client";

import { cx } from "@/components/ui";

export const PENDING_SURFACE = "animate-pulse bg-blush";

export const PENDING_RATIOS = [0.75, 1, 1.33, 0.8, 1.5, 0.67] as const;

export function counting(n: number): number[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => i);
}

export function roundedLike(shape: "hole" | "recess") {
  return shape === "hole" ? "rounded-full" : "rounded-[0.625rem]";
}

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
