"use client";

import { Skeleton, counting } from "@/components/gallery/skeleton";
import { Tile, type TileTurn } from "@/components/gallery/tile";
import { cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";

export function GridLayout({
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
