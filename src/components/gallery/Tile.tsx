"use client";

import { useCallback } from "react";
import { MdFavorite } from "react-icons/md";

import { PENDING_SURFACE } from "@/components/gallery/Skeleton";
import { Photo, cx } from "@/components/ui";
import { THUMBS_FROM_CDN } from "@/lib/client/image-optimizer";
import { aspectRatio } from "@/utils/gallery";
import { type MediaView } from "@/types/media";

export interface TileProps {
  item: MediaView;
  onActivate: (item: MediaView) => void;
  selected: boolean;
  selectable: boolean;
  shape: "hole" | "recess";
  style?: React.CSSProperties;
  className?: string;
  sizes: string;
  src?: string | null;
  natural?: boolean;
  hold?: boolean;
  onSettled?: (id: string) => void;
  favorite?: boolean;
}

export type TileTurn = Pick<
  TileProps,
  | "item"
  | "onActivate"
  | "selected"
  | "selectable"
  | "hold"
  | "onSettled"
  | "favorite"
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
  src,
  natural = false,
  hold = false,
  onSettled,
  favorite = false,
}: TileProps) {
  const source = src ?? item.previewUrl;

  const storedThumb = !src && THUMBS_FROM_CDN;

  /*
   * A server-rendered photograph can finish loading before hydration, so its `onLoad`
   * fires at nobody. Asking the element whether it is complete closes that gap.
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
      aria-label={selectable ? `Select this ${item.kind}` : `Open this ${item.kind}`}
      style={style}
      className={cx(
        shape,
        "relative block overflow-hidden transition-transform",
        selected ? "scale-95" : "hover:scale-[1.03]",
        className,
      )}
    >
      {source && hold ? (
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
      ) : source ? (
        <Photo
          src={source}
          unoptimized={storedThumb}
          alt=""
          {...(natural
            ? {
                width: item.width ?? 1200,
                height: item.height ?? 900,
                className: "h-auto w-full align-top",
              }
            : { fill: true, className: "object-cover" })}
          sizes={sizes}
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
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <span className="grid aspect-square w-[28%] min-w-7 max-w-14 place-items-center rounded-full bg-ink/55 text-linen shadow-md">
            <svg
              viewBox="0 0 24 24"
              className="ml-[8%] w-[42%]"
              fill="currentColor"
              role="presentation"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      )}

      {favorite && !selected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-[8%] top-[8%] grid h-7 w-7 place-items-center rounded-full bg-ink/55 text-linen shadow-md"
        >
          <MdFavorite className="h-4 w-4" />
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
