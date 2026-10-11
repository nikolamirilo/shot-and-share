import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ApiError, fail, handle, ok, parseBody } from "@/lib/api";
import { storageSummary } from "@/lib/events";
import { formatBytes } from "@/utils/format";
import { enforceRateLimit } from "@/lib/guards/rate-limit";
import { requireOwnedEvent } from "@/lib/guards/host-api";
import { mediaKey, scopeOfEvent, thumbKey } from "@/lib/media";
import { IMAGE_EXT, IMAGE_MIME, type ImageFormat } from "@/lib/media/formats";
import { LIMITS } from "@/constants/limits";
import { TIERS, getTier } from "@/lib/tiers";
import { classifyUpload, decideStoredObject } from "@/lib/uploads/classify";
import { createReservation } from "@/lib/uploads/reservation";
import { fileSchema } from "@/lib/uploads/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ file: fileSchema });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const event = await requireOwnedEvent(id);

    enforceRateLimit(
      LIMITS.coverUpload,
      `cover:${event.id}`,
      "That is a lot of covers at once.",
    );

    const tier = getTier(event.tier);
    if (!tier.customPage) {
      throw new ApiError(
        "forbidden",
        `Your own cover image is on ${TIERS.plus.name} and ${TIERS.pro.name}.`,
        { upgrade: true },
      );
    }

    const body = await parseBody(request, bodySchema);
    const file = body.file;

    const classified = classifyUpload(file);
    if (classified?.kind !== "photo") {
      throw new ApiError(
        "bad_request",
        "A cover has to be an image. Pick a photo rather than a video.",
      );
    }
    if (file.size > tier.maxFileBytes) {
      throw new ApiError(
        "bad_request",
        `That image is larger than ${formatBytes(tier.maxFileBytes, 0)}, which is the limit for a single upload.`,
      );
    }

    const mediaId = randomUUID();
    const scope = scopeOfEvent(event);
    const stored = decideStoredObject(file, classified);

    const thumb = file.thumb
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
      key: mediaKey(scope, "photo", mediaId, stored.ext),
      contentType: stored.contentType,
      bytes: stored.bytes,
      thumb,
      poster: null,
      tierId: tier.id,
      slack: 32 * 1024,
      media: {
        kind: "photo",
        mime_type: stored.contentType,
        media_format: stored.format,
        thumb_format: file.thumb?.format ?? null,
        duration_seconds: null,
        width: file.sourceWidth ?? null,
        height: file.sourceHeight ?? null,
        processing: stored.useCompressed ? "done" : "pending",
        /**
         * No fingerprint, and load-bearing: the guest confirm compares against it and
         * always fails.
         */
        uploader_fingerprint: null,
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
      },
    });
  });
}
