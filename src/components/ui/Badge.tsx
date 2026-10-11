import type { ReactNode } from "react";

import { cx } from "@/utils/cx";

export function Badge({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  tone?: "dark" | "brand" | "outline";
}) {
  const tones = {
    dark: "bg-ink text-linen",
    brand: "bg-claret text-chalk",
    outline: "bg-ink/8 text-ink",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
