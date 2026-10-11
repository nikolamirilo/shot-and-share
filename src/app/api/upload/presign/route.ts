import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ApiError, fail, handle, ok, parseBody } from "@/lib/api";
import { storageSummary } from "@/lib/events";
import { requireGuestEvent } from "@/lib/guards/guest";
import { formatBytes } from "@/utils/format";
import { enforceRateLimit } from "@/lib/guards/rate-limit";
import { mediaKey, posterKey, scopeOfEvent, thumbKey } from "@/lib/media";
import { IMAGE_EXT, IMAGE_MIME, type ImageFormat } from "@/lib/media/formats";
import { LIMITS } from "@/constants/limits";
import { clientIp } from "@/lib/ratelimit";
import { getTier } from "@/lib/tiers";
import { classifyUpload, decideStoredObject } from "@/lib/uploads/classify";
import { createReservation } from "@/lib/uploads/reservation";
import {
  fingerprintSchema,
  guestFileSchema,
  plausibleTakenAt,
  shareTokenSchema,
} from "@/lib/uploads/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: shareTokenSchema,
  fingerprint: fingerprintSchema,
  file: guestFileSchema,
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    enforceRateLimit(
      LIMITS.presign,
      `presign:${body.token.slice(0, 12)}:${clientIp(request.headers)}:${body.fingerprint}`,
      "Too many uploads at once. Wait a moment and try again.",
    );

    const { event } = await requireGuestEvent(body.token);
    const tier = getTier(event.tier);
    const file = body.file;

    const classified = classifyUpload(file);
    if (!classified) {
      throw new ApiError(
        "bad_request",
        "That file type is not supported. Photos and videos only.",
      );
    }
    if (classified.kind === "video" && !tier.video) {
      throw new ApiError(
        "forbidden",
        "Video is not included on the free plan. Photos work fine.",
        { upgrade: true },
      );
    }
    if (file.size > tier.maxFileBytes) {
      throw new ApiError(
        "bad_request",
        `That file is larger than ${formatBytes(tier.maxFileBytes, 0)}, which is the limit for a single upload.`,
      );
    }

    const mediaId = randomUUID();
    const scope = scopeOfEvent(event);
    const stored = decideStoredObject(file, classified);

    const poster =
      classified.kind === "video" && file.poster
        ? {
            key: posterKey(
              scope,
              mediaId,
              IMAGE_EXT[file.poster.format as ImageFormat],
            ),
            bytes: file.poster.size,
            mime: IMAGE_MIME[file.poster.format as ImageFormat],
          }
        : null;

    const thumb =
      classified.kind === "photo" && file.thumb
        ? {
            key: thumbKey(
              scope,
              mediaId,
              IMAGE_EXT[file.thumb.format as ImageFormat],
            ),
            bytes: file.thumb.size,
            mime: IMAGE_MIME[file.thumb.format as ImageFormat],
          }
        : null;

    const result = await createReservation({
      event,
      mediaId,
      key: mediaKey(scope, stored.kind, mediaId, stored.ext),
      contentType: stored.contentType,
      bytes: stored.bytes,
      thumb,
      poster,
      tierId: tier.id,
      media: {
        kind: stored.kind,
        mime_type: stored.contentType,
        media_format: stored.format,
        thumb_format: file.thumb?.format ?? null,
        duration_seconds: file.durationSeconds ?? null,
        width: file.sourceWidth ?? null,
        height: file.sourceHeight ?? null,
        processing: stored.useCompressed ? "done" : "pending",
        uploader_fingerprint: body.fingerprint,
        taken_at: plausibleTakenAt(file.takenAt),
      },
    });

    if (!result.ok) {
      const summary = storageSummary(event);
      return fail(
        "quota_exceeded",
        `This event is full. ${formatBytes(summary.remaining)} of ${formatBytes(summary.quota, 0)} left.`,
        {
          upgrade: true,
          remainingBytes: summary.remaining,
          quotaBytes: summary.quota,
        },
      );
    }

    return ok({
      upload: {
        mediaId,
        source: stored.useCompressed
          ? ("compressed" as const)
          : ("file" as const),
        media: result.media,
        thumb: result.thumb,
        poster: result.poster,
      },
    });
  });
}
