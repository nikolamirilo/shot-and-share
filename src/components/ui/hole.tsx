import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

/**
 * A punched hole. Where a circle appears in the interface it is this object at
 * a different size - list bullets, step markers, loading states, avatars.
 */
export function Hole({
  size = 16,
  className,
  children,
}: {
  size?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cx("hole inline-block shrink-0 align-middle", className)}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}
