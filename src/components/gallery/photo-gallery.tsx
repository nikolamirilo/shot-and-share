"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";
import { type GalleryLayout, aspectRatio, holeSize } from "@/lib/gallery";

/** The props a layout does not get to decide, per photograph. */
type TileTurn = Pick<
  TileProps,
  "item" | "onActivate" | "selected" | "selectable" | "hold" | "onSettled"
>;

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
  pending = 0,
  className,
}: {
  items: MediaView[];
  layout: GalleryLayout;
  onActivate: (item: MediaView) => void;
  /** Host mode. Omit entirely for a read-only gallery. */
  isSelected?: (item: MediaView) => boolean;
  /**
   * Photographs asked for and not yet arrived, drawn as empty shimmering
   * frames at the end of the wall. The wall answers the tap immediately and
   * fills in behind - rather than staying exactly as it was for two seconds,
   * which is indistinguishable from a button that did not work.
   */
  pending?: number;
  className?: string;
}) {
  const { held, settle } = useLoadQueue(items);

  /** Position in `items` is what decides a photograph's turn, in every layout. */
  const turn = (item: MediaView, index: number): TileTurn => ({
    item,
    onActivate,
    selected: isSelected?.(item) ?? false,
    selectable: Boolean(isSelected),
    hold: held(index),
    onSettled: settle,
  });

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
                {...turn(item, index)}
                shape="hole"
                style={{ width: size, height: size }}
                // Largest hole in the sequence is 188px; doubled for retina.
                sizes="384px"
              />
            </li>
          );
        })}
        {counting(pending).map((i) => {
          // Continues the sequence, so the frames on their way are the sizes
          // the photographs will actually be.
          const size = `calc(${holeSize(items.length + i)}px * var(--hole-scale, 1))`;
          return (
            <li key={`pending-${i}`}>
              <Skeleton shape="hole" style={{ width: size, height: size }} />
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
        turn={turn}
        pending={pending}
        className={className}
      />
    );
  }

  if (layout === "stack") {
    return (
      <ul className={cx("mx-auto max-w-2xl space-y-4", className)}>
        {items.map((item, index) => (
          <li key={item.id}>
            <Tile
              {...turn(item, index)}
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
        {/* Stack is one photograph per screen, so ten frames is six thousand
            pixels of shimmer. Three is already more than a guest can see. */}
        {counting(Math.min(pending, 3)).map((i) => (
          <li key={`pending-${i}`}>
            <Skeleton shape="recess" className="aspect-[4/3] w-full" />
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
      {items.map((item, index) => (
        <li key={item.id}>
          <Tile
            {...turn(item, index)}
            shape="recess"
            className="aspect-square w-full"
            // grid-cols-3 / sm:grid-cols-4 / lg:grid-cols-6
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 17vw"
          />
        </li>
      ))}
      {counting(pending).map((i) => (
        <li key={`pending-${i}`}>
          <Skeleton shape="recess" className="aspect-square w-full" />
        </li>
      ))}
    </ul>
  );
}

/** `counting(3)` is `[0, 1, 2]`. Keys and sizes both want the index. */
function counting(n: number): number[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => i);
}

/**
 * Uneven on purpose. A column of identical rectangles reads as a broken grid;
 * photographs on their way to a masonry wall are all different shapes, and
 * saying so is the whole job of the frame that stands in for one.
 */
const PENDING_RATIOS = [0.75, 1, 1.33, 0.8, 1.5, 0.67] as const;

/**
 * The space a photograph is about to take, before there is a photograph to put
 * in it - a page that has been asked for and has not come back yet.
 *
 * The same well a real one sits in, and the same shimmer a tile waiting its
 * turn in the loading queue wears. From a guest's side of the screen those are
 * one thing, "a photograph is coming here", and drawing them differently would
 * be the wall explaining its own internals to somebody who did not ask.
 */
function Skeleton({
  shape,
  style,
  className,
}: {
  shape: "hole" | "recess";
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(shape, "shimmer relative block overflow-hidden", className)}
      style={style}
    />
  );
}

/**
 * How many photographs are allowed to start loading at once.
 *
 * Handing the browser fifty images and letting it decide is what made the wall
 * fill in at random: they all start together and finish in whatever order their
 * file sizes and the venue's wifi settle on, so a photo halfway down appears
 * before the one at the top. Ten at a time, in order, means the wall fills from
 * the top down and the guest sees the newest photographs first.
 */
const LOAD_WAVE = 10;

/**
 * How long a wave gets before the next one goes anyway.
 *
 * One photograph that never arrives - a dropped connection, a request the
 * optimiser is still working on - must not hold the rest of the evening behind
 * it. The wave gives up its claim and the wall carries on.
 */
const WAVE_TIMEOUT_MS = 6000;

/**
 * Which photographs are allowed to ask the network for anything yet.
 *
 * A photograph is "settled" when it has loaded or failed; a wave is over when
 * all of its photographs have settled, and then the next ten go. Anything with
 * no preview at all is never waited on - it has nothing to fetch.
 */
function useLoadQueue(items: MediaView[]) {
  const [released, setReleased] = useState(LOAD_WAVE);
  const [settled, setSettled] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const waiting = items
    .slice(0, released)
    .filter((item) => item.previewUrl && !settled.has(item.id)).length;

  useEffect(() => {
    if (released >= items.length) return;
    if (waiting === 0) {
      setReleased((count) => count + LOAD_WAVE);
      return;
    }

    // Restarted by every photograph that lands, so this is six seconds of no
    // progress at all rather than six seconds per wave.
    const timer = setTimeout(
      () => setReleased((count) => count + LOAD_WAVE),
      WAVE_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [waiting, released, items.length]);

  const settle = useCallback((id: string) => {
    setSettled((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  return { held: (index: number) => index >= released, settle };
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
  turn,
  pending,
  className,
}: {
  items: MediaView[];
  turn: (item: MediaView, index: number) => TileTurn;
  pending: number;
  className?: string;
}) {
  const columns = useMasonryColumns();
  // The turn is carried along with the photograph: a column's second tile is
  // the second, fifth or seventh newest depending on how wide the wall is, and
  // it loads in that order rather than in its column's order.
  const lanes: TileTurn[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, index) => lanes[index % columns].push(turn(item, index)));

  return (
    <div className={cx("flex items-start gap-2 sm:gap-2.5", className)}>
      {lanes.map((lane, index) => (
        <ul
          key={index}
          className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-2.5"
        >
          {lane.map((tile) => (
            <li key={tile.item.id}>
              <Tile
                {...tile}
                shape="recess"
                style={{
                  aspectRatio: aspectRatio(tile.item.width, tile.item.height),
                  width: "100%",
                }}
                // Two columns on a phone, three from sm, four from lg.
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </li>
          ))}
          {/* Dealt into the columns the same way the photographs are, so the
              wall grows evenly rather than sprouting a tail on the left. */}
          {counting(pending)
            .filter((i) => (items.length + i) % columns === index)
            .map((i) => (
              <li key={`pending-${i}`}>
                <Skeleton
                  shape="recess"
                  style={{
                    aspectRatio: PENDING_RATIOS[i % PENDING_RATIOS.length],
                    width: "100%",
                  }}
                />
              </li>
            ))}
        </ul>
      ))}
    </div>
  );
}

interface TileProps {
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
  /** Its turn has not come yet: an empty well, and nothing asked of the network. */
  hold?: boolean;
  /** Loaded, or given up on. Either way the wave is one photograph nearer done. */
  onSettled?: (id: string) => void;
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
  hold = false,
  onSettled,
}: TileProps) {
  /*
   * A photograph can finish loading before React has hydrated the page - the
   * host's wall is server-rendered, and a cached thumbnail arrives long before
   * the JavaScript does. Its `onLoad` fired at no one, so the wave would sit
   * there waiting for a photograph that is already on screen and only move on
   * when the stall timer ran out. Asking the element whether it is already
   * complete closes that gap.
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
        // A ring is a border by another name, and it could not follow this
        // tile anyway: the same button is a square in Grid and a circle in
        // Holes. A wash over the photograph and a mark on top of it works at
        // either shape, and is easier to pick out of a wall of thumbnails.
        selected ? "scale-95" : "hover:scale-[1.03]",
        className,
      )}
    >
      {item.previewUrl && hold ? (
        /*
         * Waiting its turn in the loading queue: the right shape, so the wall
         * does not jump when the photograph lands in it, and shimmering like
         * any other frame with a photograph on the way. A still, empty well
         * here would be the same picture the wall shows for a photograph that
         * failed to load, when this one has not been asked for yet.
         */
        <span
          aria-hidden="true"
          className={cx(
            "shimmer relative block overflow-hidden",
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
          /*
           * Eager, which reads as the wrong answer for a wall of photographs
           * and is the right one here: the queue is already holding everything
           * back to ten at a time. Left lazy the two would fight - the browser
           * would decline to fetch a released photograph that is below the
           * fold, the wave would never finish, and the wall would advance on
           * the stall timer instead of on photographs actually arriving.
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

/**
 * The host's switch, in their own console.
 *
 * It is not on the guest page: there the layout is the host's decision, part of
 * the event page they designed. This is the host looking through their own
 * photographs, where how they like to look at a wall of them is their business
 * and is remembered in their browser. Deliberately small and out of the way -
 * it is a preference, not a call to action.
 */
