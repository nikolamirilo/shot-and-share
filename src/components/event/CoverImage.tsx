"use client";

import { useCallback, useState } from "react";

import { cx } from "@/components/ui";

/** `complete` alone is not the question: it is also true for an image that failed. */
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
  previewUrl?: string | null;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  /** A cached cover decodes before hydration, so its `onLoad` fires at nobody. */
  const settleWhenReady = useCallback((node: HTMLImageElement | null) => {
    if (hasDecoded(node)) setLoaded(true);
  }, []);

  return (
    <span className="relative block h-full w-full overflow-hidden bg-well">
      {previewUrl ? (
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

      <img
        src={url}
        alt=""
        ref={settleWhenReady}
        fetchPriority="high"
        decoding="async"
        onLoad={() => setLoaded(true)}
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
