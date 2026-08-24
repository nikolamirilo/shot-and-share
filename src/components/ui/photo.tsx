"use client";

import NextImage, { type ImageProps } from "next/image";
import { type Ref, useState } from "react";

import {
  reportOptimiserFailure,
  useOptimiserOff,
} from "@/lib/client/image-optimizer";

/**
 * A photograph, through the optimiser while the optimiser is answering.
 *
 * Everywhere that shows somebody's uploads uses this rather than `next/image`
 * directly, because the optimiser is metered and the meter runs out. When it
 * does, `/_next/image` starts returning an error and every frame on the wall
 * breaks at once - on a gallery whose link has already gone round a wedding.
 *
 * So a failed fetch is not the end of the picture. The same photograph is
 * asked for again straight from the bucket, where it has been all along: the
 * thumbnail is a ~25 KB WebP sized for these tiles, so the fallback costs
 * little more than the optimised copy would have. It just is not resized.
 *
 * There is a switch as well - see `@/lib/client/image-optimizer` - for turning
 * the whole thing off deliberately before the quota runs out rather than after.
 */
export function Photo({
  onError,
  unoptimized,
  ref,
  ...props
}: ImageProps & { ref?: Ref<HTMLImageElement | null> }) {
  /*
   * Which source failed, rather than a plain "it failed": the lightbox keeps
   * one of these mounted and steps the photograph through it, and the next
   * photograph deserves the optimised copy even if this one had none.
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const optimiserOff = useOptimiserOff();

  const src = typeof props.src === "string" ? props.src : null;
  const raw = unoptimized || optimiserOff || (src !== null && failedSrc === src);

  return (
    <NextImage
      {...props}
      ref={ref}
      unoptimized={raw}
      onError={(e) => {
        /*
         * Already raw, so this is the photograph itself: the object is gone,
         * or the signature expired. Nothing left to try - hand it back to the
         * caller, which is usually a queue waiting to be told this one is done.
         */
        if (raw) {
          onError?.(e);
          return;
        }
        // Retry this one unoptimised, and tell the page: enough of these and
        // it stops asking the optimiser for anything.
        setFailedSrc(src);
        reportOptimiserFailure();
      }}
    />
  );
}
