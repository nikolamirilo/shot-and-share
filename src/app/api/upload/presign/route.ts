import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ApiError, fail, handle, ok, parseBody } from "@/lib/api";
import { requireGuestEvent, storageSummary } from "@/lib/events";
import { formatBytes } from "@/lib/format";
import { enforceRateLimit } from "@/lib/guards";
import { mediaKey, posterKey, scopeOfEvent } from "@/lib/media";
import { IMAGE_EXT, IMAGE_MIME, type ImageFormat } from "@/lib/media/formats";
import { LIMITS, clientIp } from "@/lib/ratelimit";
import { getTier } from "@/lib/tiers";
import { classifyUpload, decideStoredObject } from "@/lib/uploads/classify";
import { createReservation } from "@/lib/uploads/reservation";
import {
  fingerprintSchema,
  guestFileSchema,
  shareTokenSchema,
} from "@/lib/uploads/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: shareTokenSchema,
  fingerprint: fingerprintSchema,
  uploaderName: z.string().trim().max(60).optional().nullable(),
  /**
   * One file. The browser used to send the whole batch at once, which meant no
   * photo could start uploading until the slowest had finished compressing.
   */
  file: guestFileSchema,
});

/**
 * Reserve the space, sign the URL, and write down what to do when the bytes
 * arrive. One file per request.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    enforceRateLimit(
      LIMITS.presign,
      `presign:${body.token.slice(0, 12)}:${clientIp(request.headers)}`,
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
    // Every key this request signs is anchored to the host who owns the event,
    // never to anything the guest sent.
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

    const result = await createReservation({
      event,
      mediaId,
      key: mediaKey(scope, mediaId, stored.ext),
      contentType: stored.contentType,
      bytes: stored.bytes,
      poster,
      tierId: tier.id,
      media: {
        kind: stored.kind,
        mime_type: stored.contentType,
        media_format: stored.format,
        duration_seconds: file.durationSeconds ?? null,
        width: file.sourceWidth ?? null,
        height: file.sourceHeight ?? null,
        // The worker still owes us something whenever the object in the bucket
        // is not already a compressed, universally viewable file.
        processing: stored.useCompressed ? "done" : "pending",
        uploader_fingerprint: body.fingerprint,
        uploader_name: body.uploaderName || null,
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
        /** Which blob to send: the compressed copy, or the file itself. */
        source: stored.useCompressed
          ? ("compressed" as const)
          : ("file" as const),
        media: result.media,
        poster: result.poster,
      },
    });
  });
}
