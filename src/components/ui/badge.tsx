import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export function Badge({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  tone?: "dark" | "brand" | "outline";
}) {
  /* All three are fills. `outline` keeps its name and its job - the quietest
     of the three - but earns it with a wash of ink rather than a stroke. */
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
