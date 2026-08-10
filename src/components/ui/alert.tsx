import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export type AlertTone = "notice" | "error" | "ok";

/**
 * Something the page needs to say before the host reads anything else.
 *
 * Three tones, and the difference is what the message is for. `notice` is news
 * the page is announcing - a payment landed, a window closed - and sits on
 * Gouda. `error` and `ok` are a form answering back, and go through the `note`
 * surface, which is what every reply inside a card uses.
 *
 * This markup was written out by hand at fifteen sites, which is how it
 * drifted: some carried `mt-4`, some `mt-3`, some were `font-semibold` and some
 * were not. Spacing stays the caller's business; everything else is here.
 */
export function Alert({
  tone = "error",
  className,
  children,
}: {
  tone?: AlertTone;
  className?: string;
  children: ReactNode;
}) {
  if (tone === "notice") {
    return (
      <div className={cx("rounded-card bg-blush p-4 sm:p-5", className)}>
        <p className="text-small leading-relaxed">{children}</p>
      </div>
    );
  }

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "note p-3 text-small",
        tone === "error" ? "font-semibold" : "",
        className,
      )}
    >
      {children}
    </p>
  );
}
