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

function pick(): ModerationDriver {
  if (env.moderationProvider !== "rekognition") return noModeration;

  // Rekognition reads the object out of the bucket, so no bucket means no check.
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

export function hasModeration(): boolean {
  return moderation().name !== "none";
}

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
