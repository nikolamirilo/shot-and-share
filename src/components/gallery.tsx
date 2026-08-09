"use client";

import Image from "next/image";

import { cx } from "@/components/ui";
import type { MediaView } from "@/lib/events";
import {
  GALLERY_LAYOUTS,
  type GalleryLayout,
  aspectRatio,
  holeSize,
} from "@/lib/gallery";

/**
 * One gallery, four shapes, used by both the guest page and the host dashboard.
 *
 * The host selects and deletes; the guest opens a lightbox. Rather than two
 * components drifting apart, the difference is one callback and an optional
 * selected set - everything about how a photo is *presented* stays in one place.
 */
export function PhotoGallery({
  items,
  layout,
  onActivate,
  isSelected,
  className,
}: {
  items: MediaView[];
  layout: GalleryLayout;
  onActivate: (item: MediaView) => void;
  /** Host mode. Omit entirely for a read-only gallery. */
  isSelected?: (item: MediaView) => boolean;
  className?: string;
}) {
  if (layout === "holes") {
    return (
      <ul
        className={cx(
          "hole-wall flex flex-wrap items-center gap-2.5 sm:gap-3",
          className,
        )}
      >
        {items.map((item, index) => {
          // `--hole-scale` comes from .hole-wall and shrinks the whole
          // sequence on a phone, keeping the rhythm between sizes intact.
          const size = `calc(${holeSize(index)}px * var(--hole-scale, 1))`;
          return (
            <li key={item.id}>
              <Tile
                item={item}
                onActivate={onActivate}
                selected={isSelected?.(item) ?? false}
                selectable={Boolean(isSelected)}
                shape="hole"
                style={{ width: size, height: size }}
                // Largest hole in the sequence is 188px; doubled for retina.
                sizes="384px"
              />
            </li>
          );
        })}
      </ul>
    );
  }

  if (layout === "masonry") {
    return (
      /**
       * CSS columns rather than a JS masonry library: no measuring pass, no
       * layout thrash when a photo loads, and it reflows for free. The known
       * cost is that reading order runs down each column instead of across -
       * acceptable for a photo wall where nothing depends on sequence.
       */
      <ul
        className={cx(
          "columns-2 gap-2 sm:columns-3 sm:gap-2.5 lg:columns-4 [&>li]:mb-2 sm:[&>li]:mb-2.5",
          className,
        )}
      >
        {items.map((item) => (
          <li key={item.id} className="break-inside-avoid">
            <Tile
              item={item}
              onActivate={onActivate}
              selected={isSelected?.(item) ?? false}
              selectable={Boolean(isSelected)}
              shape="recess"
              style={{
                aspectRatio: aspectRatio(item.width, item.height),
                width: "100%",
              }}
              // columns-2 / sm:columns-3 / lg:columns-4
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </li>
        ))}
      </ul>
    );
  }

  if (layout === "stack") {
    return (
      <ul className={cx("mx-auto max-w-2xl space-y-4", className)}>
        {items.map((item) => (
          <li key={item.id}>
            <Tile
              item={item}
              onActivate={onActivate}
              selected={isSelected?.(item) ?? false}
              selectable={Boolean(isSelected)}
              shape="recess"
              /**
               * No forced aspect ratio here, unlike Masonry: the tile takes the
               * photo's own height. Masonry needs the stored ratio to reserve
               * column space before the image loads, but Stack is one column,
               * so the only thing a declared ratio can do is disagree with the
               * actual thumbnail - an EXIF rotation we did not account for -
               * and letterbox the photo in dark bars.
               *
               * Full-resolution objects would be the obvious choice at this
               * size and the wrong one: a 4 MB photo per row, fifty rows, on
               * venue wifi. A resize to the column width holds up.
               */
              natural
              // mx-auto max-w-2xl, so 672px once there is room for it.
              sizes="(max-width: 704px) 100vw, 672px"
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      className={cx(
        "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-6",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.id}>
          <Tile
            item={item}
            onActivate={onActivate}
            selected={isSelected?.(item) ?? false}
            selectable={Boolean(isSelected)}
            shape="recess"
            className="aspect-square w-full"
            // grid-cols-3 / sm:grid-cols-4 / lg:grid-cols-6
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 17vw"
          />
        </li>
      ))}
    </ul>
  );
}

function Tile({
  item,
  onActivate,
  selected,
  selectable,
  shape,
  style,
  className,
  sizes,
  natural = false,
}: {
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
}) {
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
        // A ring is a border by another name, and it could not follow this
        // tile anyway: the same button is a square in Grid and a circle in
        // Holes. A wash over the photograph and a mark on top of it works at
        // either shape, and is easier to pick out of a wall of thumbnails.
        selected ? "scale-95" : "hover:scale-[1.03]",
        className,
      )}
    >
      {item.previewUrl ? (
        /*
         * The stored object is full size - there is no thumbnail in the bucket
         * any more - so the tile asks the optimiser for something tile-sized.
         * `sizes` is what decides that, and it is passed in per layout rather
         * than guessed here: a 96px hole and a full-width stack row want very
         * different files out of the same photo.
         */
        <Image
          src={item.previewUrl}
          alt=""
          {...(natural
            ? {
                // Stack takes the photo's own height. Real dimensions when we
                // have them, a 4:3 placeholder when we do not - it only has to
                // hold space until the image lands.
                width: item.width ?? 1200,
                height: item.height ?? 900,
                className: "h-auto w-full align-top",
              }
            : { fill: true, className: "object-cover" })}
          sizes={sizes}
          loading="lazy"
        />
      ) : (
        <span
          className={cx(
            "flex w-full items-center justify-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-gouda-light",
            natural ? "aspect-[4/3]" : "h-full",
          )}
        >
          {item.kind}
        </span>
      )}

      {item.kind === "video" && (
        <span className="absolute bottom-1 left-1 rounded-full bg-pepper px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-butter">
          video
        </span>
      )}

      {selected && (
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-pepper/45"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gouda text-pepper shadow-md">
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

/**
 * The host's switch, in their own console.
 *
 * It is not on the guest page: there the layout is the host's decision, part of
 * the event page they designed. This is the host looking through their own
 * photographs, where how they like to look at a wall of them is their business
 * and is remembered in their browser. Deliberately small and out of the way -
 * it is a preference, not a call to action.
 */
export function LayoutSwitcher({
  value,
  onChange,
  label = "Layout",
}: {
  value: GalleryLayout;
  onChange: (layout: GalleryLayout) => void;
  label?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label="Gallery layout"
        className="flex overflow-hidden rounded-full shadow-sm"
      >
        {GALLERY_LAYOUTS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            title={option.hint}
            onClick={() => onChange(option.id)}
            className={cx(
              "min-h-9 px-3 py-1.5 text-[0.8125rem] font-semibold leading-tight transition-colors",
              value === option.id
                ? "bg-pepper text-butter"
                : "bg-cream text-pepper hover:bg-gouda-light",
            )}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/*
 * There was a LayoutChooser here - a radio-button version of the host's picker,
 * unused since the appearance form grew its own, and carrying the sentence
 * "they can switch it for themselves afterwards", which is no longer true of
 * any page in the product. Dead copy that contradicts the product is worse than
 * no copy, so it is gone rather than corrected.
 */
