"use client";

import { Skeleton, counting } from "@/components/gallery/Skeleton";
import { Tile, type TileTurn } from "@/components/gallery/Tile";
import { cx } from "@/components/ui";
import { type MediaView } from "@/types/media";

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
            natural
            src={item.fullUrl ?? item.previewUrl}
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
