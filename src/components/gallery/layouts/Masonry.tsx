"use client";

import { useEffect, useState } from "react";

import {
  PENDING_RATIOS,
  Skeleton,
  counting,
} from "@/components/gallery/Skeleton";
import { Tile, type TileTurn } from "@/components/gallery/Tile";
import { cx } from "@/components/ui";
import { aspectRatio } from "@/utils/gallery";
import { type MediaView } from "@/types/media";

/**
 * The `sm` and `lg` breakpoints. Dealt in JavaScript, so Tailwind cannot be left to do
 * it.
 */
const STEPS = [
  { query: "(min-width: 64rem)", columns: 4 },
  { query: "(min-width: 40rem)", columns: 3 },
] as const;
const MIN_COLUMNS = 2;

function useColumns() {
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
