import "server-only";

import { screenObject } from "@/lib/moderation";
import type { ModerationVerdict } from "@/lib/moderation/types";

export type ReviewState = "approved" | "held" | "reported";

export interface ReviewColumns {
  review_state: ReviewState;
  moderation_labels: ModerationVerdict["labels"] | null;
  moderated_at: string | null;
}

/** The formats Rekognition will read. Everything else waits for the worker. */
const SCREENABLE = /\.(jpe?g|png)$/i;

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

export async function decideReview(args: {
  key: string | null;
  requireApproval: boolean;
  autoScan: boolean;
}): Promise<ReviewColumns> {
  const verdict: ModerationVerdict | null =
    args.autoScan && args.key ? await screenObject(args.key) : null;

  const screened =
    verdict !== null &&
    (verdict.outcome === "clean" || verdict.outcome === "flagged");

  const held = args.requireApproval || verdict?.allowed === false;

  return {
    review_state: held ? "held" : "approved",
    // An empty array is a clean pass; null means nobody looked. The two must not blur.
    moderation_labels: screened ? (verdict?.labels ?? []) : null,
    moderated_at: screened ? new Date().toISOString() : null,
  };
}
