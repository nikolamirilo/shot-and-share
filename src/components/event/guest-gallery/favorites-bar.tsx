"use client";

import { MdOutlineFileDownload } from "react-icons/md";

import { Button } from "@/components/ui";

/**
 * What the favourites tab is, and the one thing to do with it. The list lives
 * on this phone and nowhere else, which a guest has to be told before they
 * treat it as saved.
 */
export function FavoritesBar({
  count,
  pending,
  error,
  onDownload,
}: {
  count: number;
  pending: boolean;
  error: string | null;
  onDownload: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[0.9375rem] text-ash">
        Saved on this phone only. Tap the heart on a photo to add or remove it.
      </p>
      <Button onClick={onDownload} disabled={pending} size="sm">
        <MdOutlineFileDownload aria-hidden className="shrink-0 text-[1.25em]" />
        {pending
          ? "Preparing…"
          : `Download ${count === 1 ? "favourite" : `all ${count}`}`}
      </Button>
      {error && (
        <p className="w-full text-[0.8125rem] text-claret">{error}</p>
      )}
    </div>
  );
}
