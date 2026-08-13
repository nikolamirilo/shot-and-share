"use client";

import { useEffect, useState } from "react";

import {
  PENDING_RATIOS,
  Skeleton,
  counting,
} from "@/components/gallery/skeleton";
import { Tile, type TileTurn } from "@/components/gallery/tile";
import { cx } from "@/components/ui";
import { aspectRatio } from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

/**
 * How wide the wall has to be for a third and a fourth column. These are the
 * `sm` and `lg` breakpoints; the columns are dealt in JavaScript, so they have
 * to be stated here rather than left to Tailwind.
 */
const STEPS = [
  { query: "(min-width: 64rem)", columns: 4 },
  { query: "(min-width: 40rem)", columns: 3 },
] as const;
const MIN_COLUMNS = 2;

function useColumns() {
  // Two on the server and on the first paint. The wall is loaded by the client
  // in both places it appears, so this is a starting value rather than
  // something a visitor sees settle.
  const [columns, setColumns] = useState(MIN_COLUMNS);

  useEffect(() => {
    const lists = STEPS.map((step) => window.matchMedia(step.query));
    const read = () => {
      const hit = lists.findIndex((list) => list.matches);
      setColumns(hit === -1 ? MIN_COLUMNS : STEPS[hit].columns);
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
 * fills a column to the bottom before starting the next. The gallery is newest
 * first, so with four columns the top row showed photographs from four
 * different points in the night. Dealing them across the columns like cards
 * puts the newest handful along the top row instead.
 *
 * The cost is that the columns are separate lists, so a screen reader hears one
 * column and then the next rather than the exact order on screen. Each column
 * is still newest first, and the tiles carry no sequence in their labels.
 */
export function MasonryLayout({
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
  const columns = useColumns();
  // The turn is carried along with the photograph: a column's second tile is
  // the second, fifth or seventh newest depending on how wide the wall is, and
  // it loads in that order rather than in its column's order.
  const lanes: TileTurn[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, index) => lanes[index % columns].push(turn(item, index)));

  return (
    <div className={cx("flex items-start gap-2 sm:gap-2.5", className)}>
      {lanes.map((lane, index) => (
        <ul key={index} className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-2.5">
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
