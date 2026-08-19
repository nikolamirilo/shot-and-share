import "server-only";

import { screenObject } from "@/lib/moderation";
import type { ModerationVerdict } from "@/lib/moderation/types";

/**
 * Turning a moderation verdict into the three columns a media row carries.
 *
 * Shared by the upload path and the transcode worker's callback, because a
 * photograph that arrived as HEIC gets its first screenable copy only after the
 * worker has converted it, and both places have to reach the same answer.
 */

export type ReviewState = "approved" | "held" | "reported";

export interface ReviewColumns {
  review_state: ReviewState;
  moderation_labels: ModerationVerdict["labels"] | null;
  moderated_at: string | null;
}

/**
 * The formats Amazon Rekognition will read. Everything else has to wait for the
 * worker to produce a copy it can.
 *
 * Read off the key rather than the `media_format` column on purpose: the key
 * carries the extension the object was actually written with, and the column
 * has been wrong before for rows written by an older client.
 */
const SCREENABLE = /\.(jpe?g|png)$/i;

/**
 * Which object to hand the checker, or null when this row has none yet.
 *
 * A photo is screened on its full copy. A video is screened on its poster
 * frame, which is the only still it has, and which is JPEG for exactly this
 * reason - see POSTER_IMAGE_FORMATS.
 */
export function screenableKey(row: {
  kind: string;
  media_key: string;
  poster_key: string | null;
}): string | null {
  if (row.kind !== "video" && SCREENABLE.test(row.media_key)) {
    return row.media_key;
  }
  if (row.poster_key && SCREENABLE.test(row.poster_key)) {
    return row.poster_key;
  }
  return null;
}

/**
 * What state a newly arrived upload should land in.
 *
 * Two things decide it, in this order:
 *
 *   1. The host's switch. An event set to hold everything holds everything, and
 *      the screening still runs, because a host facing four hundred photos
 *      wants to know which three to look at first.
 *   2. The automated check. Anything it flags is held.
 *
 * A check that could not run - no provider configured, an unscreenable format,
 * AWS having an afternoon - lets the upload through and records that nobody
 * looked. That is the deliberate direction to fail in: an outage must not stop
 * a wedding, and the host controls and the report button are still standing.
 */
export async function decideReview(args: {
  key: string | null;
  requireApproval: boolean;
}): Promise<ReviewColumns> {
  const verdict: ModerationVerdict | null = args.key
    ? await screenObject(args.key)
    : null;

  const screened =
    verdict !== null &&
    (verdict.outcome === "clean" || verdict.outcome === "flagged");

  const held = args.requireApproval || verdict?.allowed === false;

  return {
    review_state: held ? "held" : "approved",
    // Only what a real check produced. An empty array from a clean pass is
    // meaningful; null means nobody looked, and the two must not blur.
    moderation_labels: screened ? (verdict?.labels ?? []) : null,
    moderated_at: screened ? new Date().toISOString() : null,
  };
}
