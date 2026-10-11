"use client";

export const OPTIMISER_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION === "1" ||
  process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION === "true";

export const THUMBS_FROM_CDN = Boolean(
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
);

const GIVE_UP_AFTER = 3;

let failures = 0;
let off = OPTIMISER_DISABLED;
const listeners = new Set<() => void>();

export function isOptimiserOff(): boolean {
  return off;
}

/** Exported for the hook in @/hooks/useOptimiserOff, which is its only caller. */
export function optimiserServerSnapshot(): boolean {
  return OPTIMISER_DISABLED;
}

export function subscribeToOptimiser(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function reportOptimiserFailure(): void {
  if (off) return;
  failures += 1;
  if (failures < GIVE_UP_AFTER) return;
  off = true;
  for (const listener of listeners) listener();
}
