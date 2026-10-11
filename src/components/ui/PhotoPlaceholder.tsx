import type { CSSProperties } from "react";

import { cx } from "@/utils/cx";

export function PhotoPlaceholder({
  shape = "recess",
  label,
  className,
  style,
}: {
  shape?: "recess" | "hole";
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx(
        shape,
        "flex flex-col items-center justify-center gap-1.5 overflow-hidden",
        className,
      )}
      style={style}
    >
      <PhotoIcon className="h-auto w-[34%] min-w-3.5 max-w-10 text-rose-soft opacity-75" />
      {label && <span className="eyebrow text-rose-soft">{label}</span>}
    </div>
  );
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="1"
        y="1"
        width="22"
        height="18"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="7.5" cy="7" r="2" fill="currentColor" />
      <path
        d="M3 15.5 8.5 10 12 13.5 15.5 11 21 15.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
