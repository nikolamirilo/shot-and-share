import type { CSSProperties } from "react";

import { cx } from "@/lib/cx";

/**
 * The space a photograph takes, before there is one.
 *
 * A drawing of a page draws its pictures rather than loading them. The host's
 * preview is judging the shape of the gallery and the colours around it, and a
 * real photograph is the one thing that would answer that question with
 * somebody's wedding instead - four faces in a tile tell you nothing about
 * whether the tile is the right size.
 *
 * The frame is the same recess or hole a real photo sits in, so the surface
 * being judged is the real surface: the void colour, the inner shadow and the
 * accent are all the theme's own.
 */
export function PhotoPlaceholder({
  shape = "recess",
  label,
  className,
  style,
}: {
  shape?: "recess" | "hole";
  /** Only where the empty frame has something to say - the cover slot. */
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
      {/* Percentage width rather than a fixed size: the same placeholder is a
          188px hole and a 40px one, and an icon that does not scale with its
          frame looks like a bug in one of them. */}
      <PhotoIcon className="h-auto w-[34%] min-w-3.5 max-w-10 text-gouda opacity-75" />
      {label && <span className="eyebrow text-gouda">{label}</span>}
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
