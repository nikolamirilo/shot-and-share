import "server-only";

import { env, hasS3 } from "@/lib/env";
import { noModeration } from "@/lib/moderation/none";
import { rekognitionModeration } from "@/lib/moderation/rekognition";
import type { ModerationDriver, ModerationVerdict } from "@/lib/moderation/types";

export type {
  ModerationDriver,
  ModerationLabel,
  ModerationOutcome,
  ModerationVerdict,
} from "@/lib/moderation/types";

/**
 * Which driver answers, decided once.
 *
 * The seam exists for two reasons and only one of them is swapping vendors. The
 * other is that a laptop, a preview deployment and the test suite all have no
 * AWS credentials, and every one of them still has to be able to run an upload
 * end to end. Unconfigured is a supported state here, exactly as it is for
 * storage and for checkout.
 */
function pick(): ModerationDriver {
  if (env.moderationProvider !== "rekognition") return noModeration;

  // Rekognition reads the object out of the bucket by key. Without a bucket
  // there is nothing for it to read, so a half-configured deployment falls back
  // rather than failing every upload.
  if (!hasS3) {
    console.warn(
      "[moderation] rekognition is selected but S3 is not configured; uploads will not be screened.",
    );
    return noModeration;
  }

  return rekognitionModeration;
}

let driver: ModerationDriver | null = null;

export function moderation(): ModerationDriver {
  if (!driver) driver = pick();
  return driver;
}

/** Whether anything is actually screening. Used for copy, never for a decision. */
export function hasModeration(): boolean {
  return moderation().name !== "none";
}

/**
 * Screen one stored object.
 *
 * Thin on purpose: callers should not have to know which driver is loaded, and
 * a driver that throws in spite of its contract must not take an upload down
 * with it.
 */
export async function screenObject(key: string): Promise<ModerationVerdict> {
  try {
    return await moderation().screen(key);
  } catch (error) {
    console.error("[moderation] driver threw", error);
    return {
      allowed: true,
      outcome: "error",
      labels: [],
      provider: moderation().name,
    };
  }
}
