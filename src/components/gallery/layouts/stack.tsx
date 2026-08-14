"use client";

import { Skeleton, counting } from "@/components/gallery/skeleton";
import { Tile, type TileTurn } from "@/components/gallery/tile";
import { cx } from "@/components/ui";
import type { MediaView } from "@/lib/media-view";

/** One photograph per screen, so ten frames is six thousand pixels of shimmer. */
const MAX_PENDING = 3;

export function StackLayout({
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
    <ul className={cx("mx-auto max-w-2xl space-y-4", className)}>
      {items.map((item, index) => (
        <li key={item.id}>
          <Tile
            {...turn(item, index)}
            shape="recess"
            /**
             * No forced aspect ratio, unlike Masonry: the tile takes the
             * photo's own height. Masonry needs the stored ratio to reserve
             * column space before the image loads; Stack is one column, so the
             * only thing a declared ratio can do is disagree with the actual
             * thumbnail and letterbox the photo in dark bars.
             */
            natural
            // mx-auto max-w-2xl, so 672px once there is room for it.
            sizes="(max-width: 704px) 100vw, 672px"
          />
        </li>
      ))}
      {counting(Math.min(pending, MAX_PENDING)).map((i) => (
        <li key={`pending-${i}`}>
          <Skeleton shape="recess" className="aspect-[4/3] w-full" />
        </li>
      ))}
    </ul>
  );
}
