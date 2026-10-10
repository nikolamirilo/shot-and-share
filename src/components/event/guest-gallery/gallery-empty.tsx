"use client";

import type { View } from "@/components/event/guest-gallery/use-gallery-wall";
import { Hole } from "@/components/ui";

/**
 * A wall with nothing on it yet. A well rather than blank space, because the
 * first guest of the evening is looking at an empty page and needs to be told
 * that is what it is.
 */
export function GalleryEmpty({ view }: { view: View }) {
  const noun = view === "video" ? "videos" : "photos";

  return (
    <div className="inset-shadow-well mt-6 rounded-[1.25rem] bg-ink/5 px-5 py-8 text-center sm:p-8">
      <div className="mx-auto flex w-fit gap-2">
        <Hole size={16} />
        <Hole size={24} />
        <Hole size={12} />
      </div>
      {view === "favorites" ? (
        <>
          <p className="mt-5 text-lead">No favourites yet.</p>
          <p className="mt-1 text-[0.9375rem] text-ash">
            Open a photo and tap the heart to keep it here.
          </p>
        </>
      ) : (
        <>
          <p className="mt-5 text-lead">No {noun} yet.</p>
          <p className="mt-1 text-[0.9375rem] text-ash">
            Be the first - yours will appear right here.
          </p>
        </>
      )}
    </div>
  );
}
