import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export type AlertTone = "notice" | "error" | "ok";

/**
 * Something the page needs to say first. `notice` is news the page announces
 * and sits on Gouda; `error` and `ok` are a form answering back and go through
 * the `note` surface. Spacing stays the caller's business.
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
