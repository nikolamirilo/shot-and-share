import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ApiError, fail, handle, ok, parseBody } from "@/lib/api";
import { requireGuestEvent, storageSummary } from "@/lib/events";
import {
  MAX_FILES_PER_REQUEST,
  MAX_THUMB_BYTES,
  classify,
  originalKey,
  thumbKey,
} from "@/lib/media";
import { LIMITS, clientIp, rateLimit } from "@/lib/ratelimit";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTier } from "@/lib/tiers";
import { formatBytes } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  fingerprint: z.string().min(8).max(64),
  uploaderName: z.string().trim().max(60).optional().nullable(),
  files: z
    .array(
      z.object({
        size: z.number().int().positive(),
        type: z.string().min(3).max(120),
        thumbSize: z.number().int().nonnegative().max(MAX_THUMB_BYTES).optional(),
      }),
    )
    .min(1)
    .max(MAX_FILES_PER_REQUEST),
});

/**
 * The quota check happens here, before a single presigned URL is issued.
 *
 * Checking afterwards means the bytes are already in the bucket and already
 * billable — the guest has uploaded, we have paid for the transfer, and the
 * only thing left to do is delete it. Reserving first means a full event costs
 * us one database round trip and returns an upgrade prompt instead.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    const ip = clientIp(request.headers);

    const limit = rateLimit(
      `presign:${body.token.slice(0, 12)}:${ip}`,
      LIMITS.presign.limit,
      LIMITS.presign.window,
    );
    if (!limit.ok) {
      return fail(
        "rate_limited",
        "Too many uploads at once. Wait a moment and try again.",
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    const { event } = await requireGuestEvent(body.token);
    const tier = getTier(event.tier);

    // --- Validate every file before touching storage or the quota ----------
    const prepared = body.files.map((file) => {
      const kind = classify(file.type);
      if (!kind) {
        throw new ApiError(
          "bad_request",
          "That file type is not supported. Photos and videos only.",
        );
      }
      if (kind.kind === "video" && !tier.video) {
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
      return {
        mediaId: randomUUID(),
        kind: kind.kind,
        ext: kind.ext,
        mime: file.type.toLowerCase().split(";")[0].trim(),
        size: file.size,
        thumbSize: file.thumbSize ?? 0,
      };
    });

    const totalBytes = prepared.reduce((s, f) => s + f.size + f.thumbSize, 0);

    // --- Reserve, atomically ------------------------------------------------
    const admin = createAdminClient();
    const { data: reserved, error: reserveError } = await admin.rpc(
      "reserve_storage",
      { p_event: event.id, p_bytes: totalBytes },
    );
    if (reserveError) throw new Error(reserveError.message);

    if (!reserved) {
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

    // --- Record intent, then hand out URLs -----------------------------------
    const rows = prepared.map((f) => ({
      id: f.mediaId,
      event_id: event.id,
      original_key: originalKey(event.id, f.mediaId, f.ext),
      thumb_key: f.thumbSize > 0 ? thumbKey(event.id, f.mediaId) : null,
      size_bytes: f.size,
      thumb_size_bytes: f.thumbSize,
      mime_type: f.mime,
      kind: f.kind,
      width: null,
      height: null,
      uploader_fingerprint: body.fingerprint,
      uploader_name: body.uploaderName ?? null,
      status: "pending" as const,
    }));

    const { error: insertError } = await admin.from("media").insert(rows);
    if (insertError) {
      // Give the reservation back rather than leaking quota on a failed insert.
      await admin.rpc("release_storage", {
        p_event: event.id,
        p_bytes: totalBytes,
      });
      throw new Error(insertError.message);
    }

    // Tagged with the tier so the S3 lifecycle rules can filter on it. See
    // infra/s3-lifecycle.json — the transition to Glacier Instant Retrieval is
    // what makes a twelve-month retention window affordable at all.
    const tags = { tier: tier.id };

    const uploads = await Promise.all(
      prepared.map(async (f, i) => ({
        mediaId: f.mediaId,
        original: await storage.presignUpload({
          key: rows[i].original_key,
          contentType: f.mime,
          maxBytes: f.size,
          tags,
        }),
        thumb:
          f.thumbSize > 0 && rows[i].thumb_key
            ? await storage.presignUpload({
                key: rows[i].thumb_key,
                contentType: "image/webp",
                // Small slack: the browser's encoder is not byte-deterministic.
                maxBytes: Math.max(f.thumbSize + 16 * 1024, 64 * 1024),
                tags,
              })
            : null,
      })),
    );

    return ok({ uploads });
  });
}
