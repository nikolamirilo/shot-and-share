"use client";

import Image from "next/image";

import { cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";

/**
 * A square, whatever shape the photograph is.
 *
 * The tiles are a grid rather than a wrapping row so the columns line up down
 * the dialog: a row of mixed aspect ratios reads as a jumble, and what the host
 * is scanning for is one picture among a hundred.
 */
export const TILE =
  "relative aspect-square w-full overflow-hidden rounded-xl bg-linen shadow-sm transition-shadow";
export const TILE_SELECTED = "shadow-lg";

/**
 * Which one is chosen. A mark printed on the photograph rather than a ring
 * around it: the tiles are a hundred squares of somebody's wedding, and an edge
 * four pixels wide is easy to lose among them in a way a Gouda disc is not.
 */
export function Chosen() {
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-claret text-chalk shadow-md"
    >
      <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none">
        <path
          d="M2.5 6.4 4.9 8.8 9.5 3.4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function CoverThumb({
  item,
  selected,
  onClick,
}: {
  item: MediaView;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(TILE, selected && TILE_SELECTED)}
    >
      {item.previewUrl && (
        // Through the optimiser, not a bare <img>. `previewUrl` is the stored
        // photo - a phone camera's several megabytes - and a grid of a hundred
        // of them at full size is the whole gallery pulled down to fill tiles a
        // couple of hundred pixels wide.
        <Image
          src={item.previewUrl}
          alt=""
          width={320}
          height={320}
          sizes="320px"
          className="h-full w-full object-cover"
        />
      )}
      {selected && <Chosen />}
    </button>
  );
}
