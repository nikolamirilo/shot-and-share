"use client";

import { type ReactNode, useContext } from "react";

import { TabsContext } from "@/components/ui/tabs/context";
import { cx } from "@/utils/cx";

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
