"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether photographs still go through Vercel's image optimiser.
 *
 * The optimiser is metered: every distinct source-and-width pair is one
 * transformation, and a plan has a fixed number of them per month. Past that
 * ceiling Vercel stops serving `/_next/image` and answers with an error, which
 * in a photo app is not a slower page - it is a wall of broken frames, on the
 * gallery a host has already handed out.
 *
 * So the optimiser is treated as an enhancement that can go away, in two ways:
 *
 *  - The switch. `NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION=1` and a redeploy
 *    serves every photograph straight from the bucket, spending nothing. The
 *    stored thumbnail is already a ~25 KB WebP made for these tiles, so the
 *    wall costs about what it did; only the full-size copies get heavier.
 *
 *  - The catch. If the optimiser answers with an error anyway - the quota ran
 *    out mid-month, nobody was watching the email - each picture retries
 *    itself unoptimised, and once a few have had to, the rest of the page
 *    stops asking. See `<Photo>`.
 */

/** Read once: it is inlined at build time and cannot change while running. */
export const OPTIMISER_DISABLED =
  process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION === "1" ||
  process.env.NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION === "true";

/**
 * How many photographs must fail before the page gives up on the optimiser
 * for all of them.
 *
 * Not one. A single photograph can fail on its own account - an object deleted
 * from the bucket, a signature that expired while the tab was in a pocket -
 * and that is no reason to double the bytes of every other tile. Three
 * failures is not one photograph's bad luck; it is the service.
 */
const GIVE_UP_AFTER = 3;

let failures = 0;
let off = OPTIMISER_DISABLED;
const listeners = new Set<() => void>();

/** True when photographs should be requested straight from their source. */
export function isOptimiserOff(): boolean {
  return off;
}

/**
 * The server render never knows about a failure - it has not made a request
 * yet - so it must answer with the switch alone, or the markup it sends and
 * the markup the browser expects disagree.
 */
function serverSnapshot(): boolean {
  return OPTIMISER_DISABLED;
}

/** Told when the answer to `isOptimiserOff` changes, which happens once. */
export function subscribeToOptimiser(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** One photograph could not be fetched through the optimiser. */
export function reportOptimiserFailure(): void {
  if (off) return;
  failures += 1;
  if (failures < GIVE_UP_AFTER) return;
  off = true;
  for (const listener of listeners) listener();
}

/** The same, as a hook, so a component re-renders when it changes. */
export function useOptimiserOff(): boolean {
  return useSyncExternalStore(
    subscribeToOptimiser,
    isOptimiserOff,
    serverSnapshot,
  );
}

