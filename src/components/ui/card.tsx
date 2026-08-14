import type { ElementType, ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * Two padding steps. `cx` is a plain join with no conflict resolution, so a
 * caller passing `sm:p-7` in `className` would not beat a baked-in `sm:p-6` -
 * which is why this is a prop rather than an override.
 */
const PADS = {
  snug: "p-5 sm:p-6",
  roomy: "p-5 sm:p-7",
  none: "",
} as const;

export function Card({
  children,
  className,
  pad = "snug",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  pad?: keyof typeof PADS;
  as?: ElementType;
}) {
  return <Tag className={cx("card", PADS[pad], className)}>{children}</Tag>;
}
