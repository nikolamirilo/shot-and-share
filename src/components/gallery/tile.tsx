"use client";

import Image from "next/image";
import { useCallback } from "react";

import { PENDING_SURFACE } from "@/components/gallery/skeleton";
import { cx } from "@/components/ui";
import { aspectRatio } from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

export interface TileProps {
  item: MediaView;
  onActivate: (item: MediaView) => void;
  selected: boolean;
  selectable: boolean;
  shape: "hole" | "recess";
  style?: React.CSSProperties;
  className?: string;
  /**
   * How wide this tile renders, per breakpoint. The optimiser picks which
   * resize to serve from it, so a wrong value here is either a blurry photo or
   * a phone downloading four times what it needs.
   */
  sizes: string;
  /** Let the image set the tile's height instead of cropping into a box. */
  natural?: boolean;
  /** Its turn has not come yet: an empty well, nothing asked of the network. */
  hold?: boolean;
  /** Loaded, or given up on. Either way the wave is one photograph nearer done. */
  onSettled?: (id: string) => void;
}

/** The props a layout does not get to decide, per photograph. */
export type TileTurn = Pick<
  TileProps,
  "item" | "onActivate" | "selected" | "selectable" | "hold" | "onSettled"
>;

export function Tile({
  item,
  onActivate,
  selected,
  selectable,
  shape,
  style,
  className,
  sizes,
  natural = false,
  hold = false,
  onSettled,
}: TileProps) {
  /*
   * A photograph can finish loading before React has hydrated the page - the
   * host's wall is server-rendered, and a cached thumbnail arrives long before
   * the JavaScript does. Its `onLoad` fired at no one, so the wave would wait
   * for a photograph already on screen and only move on when the stall timer
   * ran out. Asking the element whether it is already complete closes that gap.
   */
  const settleWhenReady = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete) onSettled?.(item.id);
    },
    [item.id, onSettled],
  );

  return (
    <button
      type="button"
      onClick={() => onActivate(item)}
      aria-pressed={selectable ? selected : undefined}
      aria-label={
        selectable
          ? `Select this ${item.kind}`
          : `Open this ${item.kind}${item.uploaderName ? ` from ${item.uploaderName}` : ""}`
      }
      style={style}
      className={cx(
        shape,
        "relative block overflow-hidden transition-transform",
        // A ring is a border by another name, and it could not follow this tile
        // anyway: the same button is a square in Grid and a circle in Holes. A
        // wash over the photograph and a mark on top of it works at either.
        selected ? "scale-95" : "hover:scale-[1.03]",
        className,
      )}
    >
      {item.previewUrl && hold ? (
        // Waiting its turn: the right shape, so the wall does not jump when the
        // photograph lands, and pulsing like any other frame with one on the
        // way. A still, empty well is what a *failed* photograph looks like.
        <span
          aria-hidden="true"
          className={cx(
            "block",
            PENDING_SURFACE,
            natural ? "w-full" : "h-full w-full",
          )}
          style={
            natural
              ? { aspectRatio: aspectRatio(item.width, item.height) }
              : undefined
          }
        />
      ) : item.previewUrl ? (
        /*
         * The stored object is full size - there is no thumbnail in the bucket
         * any more - so the tile asks the optimiser for something tile-sized.
         * `sizes` decides that, and is passed in per layout rather than guessed
         * here: a 96px hole and a full-width stack row want very different
         * files out of the same photo.
         */
        <Image
          src={item.previewUrl}
          alt=""
          {...(natural
            ? {
                // Real dimensions when we have them, a 4:3 placeholder when we
                // do not - it only has to hold space until the image lands.
                width: item.width ?? 1200,
                height: item.height ?? 900,
                className: "h-auto w-full align-top",
              }
            : { fill: true, className: "object-cover" })}
          sizes={sizes}
          /*
           * Eager, which reads as the wrong answer for a wall of photographs
           * and is the right one here: the queue is already holding everything
           * back to ten at a time. Left lazy the two would fight - the browser
           * would decline to fetch a released photograph below the fold, the
           * wave would never finish, and the wall would advance on the stall
           * timer instead of on photographs actually arriving.
           */
          loading="eager"
          ref={settleWhenReady}
          onLoad={() => onSettled?.(item.id)}
          onError={() => onSettled?.(item.id)}
        />
      ) : (
        <span
          className={cx(
            "flex w-full items-center justify-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-rose-soft",
            natural ? "aspect-[4/3]" : "h-full",
          )}
        >
          {item.kind}
        </span>
      )}

      {item.kind === "video" && (
        <span className="absolute bottom-1 left-1 rounded-full bg-ink px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-linen">
          video
        </span>
      )}

      {selected && (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-ink/45"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-claret text-chalk shadow-md">
            <svg viewBox="0 0 12 12" className="h-4 w-4" fill="none">
              <path
                d="M2.5 6.4 4.9 8.8 9.5 3.4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </span>
      )}
    </button>
  );
}
