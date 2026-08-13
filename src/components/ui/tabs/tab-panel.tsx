"use client";

import { type ReactNode, useContext } from "react";

import { TabsContext } from "@/components/ui/tabs/context";
import { cx } from "@/lib/cx";

/**
 * One group of settings. `display` is what the panel becomes when it is open -
 * the grid panels keep their own two-column layout on a laptop, so both classes
 * are written out in full for the compiler to find.
 *
 * Visibility is CSS rather than mounting and unmounting: a panel switched away
 * from keeps its typed text, its unsaved choices and its scroll position.
 */
export function TabPanel({
  id,
  display = "block",
  className,
  children,
}: {
  id: string;
  display?: "block" | "grid";
  className?: string;
  children: ReactNode;
}) {
  const ctx = useContext(TabsContext);
  const active = ctx?.active === id;
  const domId = ctx ? ctx.domId(id) : id;

  return (
    <div
      id={domId}
      role="tabpanel"
      aria-labelledby={`${domId}-tab`}
      className={cx(
        active ? (display === "grid" ? "grid" : "block") : "hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
