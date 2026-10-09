"use client";

import { useCallback, useState } from "react";

import { cx } from "@/components/ui";

/**
 * The cover photograph, and what stands in its place while it loads.
 *
 * The cover is the one place in the product that deliberately loads the full
 * copy rather than a thumbnail - it is a single photograph across a whole
 * phone, where 640px is visibly soft - and a full copy is a couple of
 * megabytes. On a venue's wifi that is long enough that a guest's first sight
 * of somebody's wedding was an empty rectangle with the name printed on it.
 *
 * So the thumbnail goes in first. It is 1-2% of the bytes, it is already in
 * the CDN, and blown up and blurred it is the right colours in the right
 * places within a few hundred milliseconds - the picture arrives out of
 * something true about itself rather than out of nothing. The full copy then
 * fades in over the top.
 *
 * With no thumbnail to use - a row written before the folders existed, or one
 * still waiting on the worker - the frame is the dark well with a light moving
 * over it, which is what every other frame waiting for a photograph does.
 */
/**
 * Whether this element is holding a photograph it actually decoded.
 *
 * `complete` alone is not that question: it only means the browser has
 * stopped trying, and a cover that 404ed is complete too. Answering yes to
 * that one would hide the blurred stand-in and reveal a broken-image icon in
 * its place - the exact state this component exists to prevent.
 */
export function hasDecoded(
  node: Pick<HTMLImageElement, "complete" | "naturalWidth"> | null,
): boolean {
  return node !== null && node.complete && node.naturalWidth > 0;
}

export function CoverImage({
  url,
  previewUrl,
  className,
}: {
  url: string;
  /** The stored thumbnail, when the row has one. */
  previewUrl?: string | null;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  /*
   * A cached cover is decoded before React has hydrated the page, and its
   * `onLoad` fired at nobody - so the photograph would sit at zero opacity
   * behind a blurred copy of itself for as long as the page was open. Asking
   * the element whether it already has one closes that gap. Same reason the
   * gallery's tiles do it; see components/gallery/tile.tsx.
   */
  const settleWhenReady = useCallback((node: HTMLImageElement | null) => {
    if (hasDecoded(node)) setLoaded(true);
  }, []);

  return (
    <span className="relative block h-full w-full overflow-hidden bg-well">
      {previewUrl ? (
        /* Scaled past the edges because a blur samples past them: at this
           radius an unscaled copy has a soft grey border all the way round. */
        <img
          src={previewUrl}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className={cx(
            "absolute inset-0 h-full w-full scale-110 object-cover blur-xl transition-opacity duration-500",
            loaded && "opacity-0",
          )}
        />
      ) : (
        !loaded && (
          <span
            aria-hidden="true"
            className="cover-sweep pointer-events-none absolute inset-0"
          />
        )
      )}

      {/* The cover is the first thing on the screen and the largest, so it is
          asked for ahead of everything else on the page rather than taking its
          turn among the gallery's thumbnails. */}
      <img
        src={url}
        alt=""
        ref={settleWhenReady}
        fetchPriority="high"
        decoding="async"
        onLoad={() => setLoaded(true)}
        /* A photograph that will not load leaves the blurred copy on screen,
           which is a soft cover rather than a black hole in the page. */
        onError={() => setLoaded(false)}
        className={cx(
          "relative h-full w-full object-cover transition-opacity duration-700",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </span>
  );
}
