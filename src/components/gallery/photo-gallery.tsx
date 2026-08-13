"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";
import { type GalleryLayout, aspectRatio, holeSize } from "@/lib/gallery";

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
      <Masonry
        items={items}
        onActivate={onActivate}
        isSelected={isSelected}
        className={className}
      />
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

/**
 * How wide the wall has to be for a third and a fourth column. These are the
 * `sm` and `lg` breakpoints; the columns are dealt in JavaScript now, so they
 * have to be stated here rather than left to Tailwind.
 */
const MASONRY_STEPS = [
  { query: "(min-width: 64rem)", columns: 4 },
  { query: "(min-width: 40rem)", columns: 3 },
] as const;
const MASONRY_MIN = 2;

function useMasonryColumns() {
  // Two on the server and on the first paint. The wall is loaded by the client
  // in both places it appears, so this is a starting value rather than
  // something a visitor sees settle.
  const [columns, setColumns] = useState(MASONRY_MIN);

  useEffect(() => {
    const lists = MASONRY_STEPS.map((step) => window.matchMedia(step.query));
    const read = () => {
      const hit = lists.findIndex((list) => list.matches);
      setColumns(hit === -1 ? MASONRY_MIN : MASONRY_STEPS[hit].columns);
    };

    read();
    lists.forEach((list) => list.addEventListener("change", read));
    return () =>
      lists.forEach((list) => list.removeEventListener("change", read));
  }, []);

  return columns;
}

/**
 * Nothing cropped, and the newest photographs along the top.
 *
 * This was CSS columns, which was free and had one bad property: a browser
 * fills a column to the bottom before starting the next one. The gallery is
 * newest first, so with four columns the top row showed photographs from four
 * different points in the night, and the newest ones ran down the left edge
 * instead of across the top. On a wall that grows all evening that is the whole
 * point of the ordering, gone.
 *
 * So the photographs are dealt across the columns like cards - first to the
 * first, second to the second - which puts the newest handful along the top row
 * and keeps recency running down each column after that. The cost is that the
 * columns are separate lists, so a screen reader hears one column and then the
 * next rather than the exact order on screen; each column is still newest
 * first, and the tiles carry no sequence in their labels.
 */
function Masonry({
  items,
  onActivate,
  isSelected,
  className,
}: {
  items: MediaView[];
  onActivate: (item: MediaView) => void;
  isSelected?: (item: MediaView) => boolean;
  className?: string;
}) {
  const columns = useMasonryColumns();
  const lanes: MediaView[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, index) => lanes[index % columns].push(item));

  return (
    <div className={cx("flex items-start gap-2 sm:gap-2.5", className)}>
      {lanes.map((lane, index) => (
        <ul
          key={index}
          className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-2.5"
        >
          {lane.map((item) => (
            <li key={item.id}>
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
                // Two columns on a phone, three from sm, four from lg.
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
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

/**
 * The host's switch, in their own console.
 *
 * It is not on the guest page: there the layout is the host's decision, part of
 * the event page they designed. This is the host looking through their own
 * photographs, where how they like to look at a wall of them is their business
 * and is remembered in their browser. Deliberately small and out of the way -
 * it is a preference, not a call to action.
 */
