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

/**
 * Amazon Rekognition content moderation.
 *
 * Chosen because the photographs are already sitting in an S3 bucket in the
 * same region, so the check is a key rather than an upload, the bytes never
 * leave the EU, and it costs about a tenth of a cent an image. A 300-photo
 * wedding is roughly 30 cents.
 */

/**
 * Below this the provider is guessing, and a guess that holds back a wedding
 * photo is worse than one that does not. 70 rather than the default 60 for
 * exactly that reason.
 */
const MIN_CONFIDENCE = 70;

/**
 * Which of Rekognition's categories actually stop a photograph.
 *
 * This is the list that matters, and it is shorter than the taxonomy on
 * purpose. Rekognition also returns "Alcohol", "Gambling", "Rude Gestures" and
 * "Swimwear or Underwear", every one of which describes an ordinary wedding,
 * stag do or pool party. Holding those back would train hosts to approve
 * everything without looking, which is worse than not checking at all.
 *
 * Matched as lowercase substrings against both the label and its parent, so
 * that the older taxonomy ("Explicit Nudity") and the current one ("Explicit",
 * "Non-Explicit Nudity of Intimate parts and Kissing") both land.
 */
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

      /*
       * The whole label set is stored, not only the ones that fired. A host
       * asking "why is this held" wants the reason, and a false positive
       * argued about next month needs the evidence that produced it.
       */
      return firing.length > 0
        ? { allowed: false, outcome: "flagged", labels, provider: "rekognition" }
        : { allowed: true, outcome: "clean", labels, provider: "rekognition" };
    } catch (error) {
      /*
       * Never throws. A wedding at 11pm does not stop because AWS is having an
       * afternoon, so the caller gets an honest "nobody screened this" and
       * decides for itself - which, deliberately, means letting it through.
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
