"use client";

import NextImage, { type ImageProps } from "next/image";
import { type Ref, useState } from "react";

import { useOptimiserOff } from "@/hooks/useOptimiserOff";
import { reportOptimiserFailure } from "@/lib/client/image-optimizer";

export function Photo({
  onError,
  unoptimized,
  ref,
  ...props
}: ImageProps & { ref?: Ref<HTMLImageElement | null> }) {
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
        if (raw) {
          onError?.(e);
          return;
        }
        // Retry this one unoptimised, and tell the page: enough of these and it stops
        // asking.
        setFailedSrc(src);
        reportOptimiserFailure();
      }}
    />
  );
}
