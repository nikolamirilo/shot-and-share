import { formatBytes } from "@/lib/format";
import type { Tier } from "@/lib/tiers";

/**
 * What the upload section calls the things it is asking for.
 *
 * A guest on a plan that includes video was asked for "photos" in six places,
 * and then told their clip was "1 photo" while it uploaded. The noun has to
 * follow what the plan actually accepts, so it is decided once here instead of
 * being written inline at each label - the host's preview renders the same
 * panel, and its copy had already drifted from the guest page's.
 */
export interface UploadWording {
  /** The primary button, when nothing is happening. */
  action: string;
  /** The camera half of the split variant. */
  capture: string;
  /** The library half of the split variant. */
  choose: string;
  /** What may be sent, and how big one of them may be. */
  hint: string;
}

/**
 * Takes the plan rather than two flags, because both things the copy needs -
 * whether video is in, and how big one file may be - come from it.
 *
 * It used to say "up to 50 at a time", which was true and is no longer: a
 * guest may hand over as many files as the event has room for. The number
 * worth printing is the one that can actually turn a file away on its own.
 */
export function uploadWording(
  tier: Pick<Tier, "video" | "maxFileBytes">,
): UploadWording {
  return tier.video
    ? {
        action: "Add your photos and video",
        // Not "Take a photo": the same button starts a recording, because the
        // accept list lets the camera offer both.
        capture: "Open camera",
        choose: "Choose files",
        hint: `Photos and video, up to ${formatBytes(tier.maxFileBytes, 0)} a file.`,
      }
    : {
        action: "Add your photos",
        capture: "Take a photo",
        choose: "Choose photos",
        hint: `Photos, up to ${formatBytes(tier.maxFileBytes, 0)} a file.`,
      };
}

/**
 * Progress, deliberately without a noun.
 *
 * Mid-batch there is no honest one to use: a guest can pick four photos and a
 * clip in a single tap, which makes "Optimising your photos" simply wrong. The
 * question that line answers is "is this still going", and that can be said
 * without naming what is in the queue.
 */
export const PREPARING = "Processing";
export const UPLOADING = "Uploading";

/** A count that does not commit to what was counted. */
export function countLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "items"}`;
}
