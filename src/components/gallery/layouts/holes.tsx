"use client";

import { Skeleton, counting } from "@/components/gallery/skeleton";
import { Tile, type TileTurn } from "@/components/gallery/tile";
import { cx } from "@/components/ui";
import { holeSize } from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

export function HolesLayout({
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
        "hole-wall flex flex-wrap items-center gap-2.5 sm:gap-3",
        className,
      )}
    >
      {items.map((item, index) => (
        <li key={item.id}>
          <Tile
            {...turn(item, index)}
            shape="hole"
            // `--hole-scale` comes from .hole-wall and shrinks the whole
            // sequence on a phone, keeping the rhythm between sizes intact.
            style={{ width: scaled(index), height: scaled(index) }}
            // Largest hole in the sequence is 188px; doubled for retina.
            sizes="384px"
          />
        </li>
      ))}
      {/* Continues the sequence, so the frames on their way are the sizes the
          photographs will actually be. */}
      {counting(pending).map((i) => (
        <li key={`pending-${i}`}>
          <Skeleton
            shape="hole"
            style={{
              width: scaled(items.length + i),
              height: scaled(items.length + i),
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function scaled(index: number): string {
  return `calc(${holeSize(index)}px * var(--hole-scale, 1))`;
}
