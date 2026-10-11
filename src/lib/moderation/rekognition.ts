import "server-only";

import {
  DetectModerationLabelsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";

import { env } from "@/lib/env";
import type {
  ModerationDriver,
  ModerationLabel,
  ModerationVerdict,
} from "@/lib/moderation/types";

// Below this the provider is guessing, and a guess that holds a wedding photo is worse.
const MIN_CONFIDENCE = 70;

const BLOCKING = [
  "explicit",
  "nudity",
  "sexual",
  "violence",
  "visually disturbing",
  "hate symbols",
  "drugs",
  "self-harm",
  "corpse",
  "weapon violence",
];

function blocks(label: ModerationLabel): boolean {
  const haystack = `${label.parent ?? ""} ${label.name}`.toLowerCase();
  return BLOCKING.some((term) => haystack.includes(term));
}

let client: RekognitionClient | null = null;

function rekognition(): RekognitionClient {
  if (client) return client;
  client = new RekognitionClient({
    region: env.s3.region,
    credentials: {
      accessKeyId: env.s3.accessKeyId!,
      secretAccessKey: env.s3.secretAccessKey!,
    },
  });
  return client;
}

export const rekognitionModeration: ModerationDriver = {
  name: "rekognition",

  async screen(key: string): Promise<ModerationVerdict> {
    try {
      const result = await rekognition().send(
        new DetectModerationLabelsCommand({
          Image: { S3Object: { Bucket: env.s3.bucket, Name: key } },
          MinConfidence: MIN_CONFIDENCE,
        }),
      );

      const labels: ModerationLabel[] = (result.ModerationLabels ?? [])
        .map((label) => ({
          name: label.Name ?? "",
          confidence: Math.round(label.Confidence ?? 0),
          parent: label.ParentName || undefined,
        }))
        .filter((label) => label.name.length > 0)
        .sort((a, b) => b.confidence - a.confidence);

      const firing = labels.filter(blocks);

      return firing.length > 0
        ? { allowed: false, outcome: "flagged", labels, provider: "rekognition" }
        : { allowed: true, outcome: "clean", labels, provider: "rekognition" };
    } catch (error) {
      /*
       * Never throws: the caller gets an honest "nobody screened this" and decides for
       * itself.
       */
      console.error("[moderation] rekognition failed", error);
      return {
        allowed: true,
        outcome: "error",
        labels: [],
        provider: "rekognition",
      };
    }
  },
};
