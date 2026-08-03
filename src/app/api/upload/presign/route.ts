import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ApiError, fail, handle, ok, parseBody } from "@/lib/api";
import type { Database } from "@/lib/db/types";
import { requireGuestEvent, storageSummary } from "@/lib/events";
import { formatBytes } from "@/lib/format";
import {
  IMAGE_EXT,
  IMAGE_MIME,
  type ImageFormat,
  imageFormatFromMime,
  isUniversallyViewable,
  videoFormatFromMime,
} from "@/lib/formats";
import {
  MAX_FILES_PER_REQUEST,
  MAX_THUMB_BYTES,
  classify,
  displayKey,
  originalKey,
  posterKey,
  thumbKey,
} from "@/lib/media";
import { LIMITS, clientIp, rateLimit } from "@/lib/ratelimit";
import { storage } from "@/lib/storage";
import type { PresignedUpload } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTier } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const renditionSchema = z.object({
  size: z.number().int().positive(),
  format: z.enum(["webp", "jpeg", "avif", "png"]),
  width: z.number().int().positive().max(60_000).optional(),
  height: z.number().int().positive().max(60_000).optional(),
});

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  fingerprint: z.string().min(8).max(64),
  uploaderName: z.string().trim().max(60).optional().nullable(),
  files: z
    .array(
      z.object({
        size: z.number().int().positive(),
        type: z.string().min(3).max(120),
        /** Optimised full-size copy the browser produced, if it managed one. */
        display: renditionSchema.optional().nullable(),
        thumb: renditionSchema
          .extend({ size: z.number().int().positive().max(MAX_THUMB_BYTES) })
          .optional()
          .nullable(),
        poster: renditionSchema
          .extend({ size: z.number().int().positive().max(MAX_THUMB_BYTES) })
          .optional()
          .nullable(),
        sourceWidth: z.number().int().positive().max(60_000).optional().nullable(),
        sourceHeight: z.number().int().positive().max(60_000).optional().nullable(),
        durationSeconds: z.number().nonnegative().max(86_400).optional().nullable(),
        /** The browser could not decode it; the worker has to finish the job. */
        needsServer: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(MAX_FILES_PER_REQUEST),
});

/** Where the archival object's bytes come from. */
type OriginalSource = "file" | "display";

type MediaInsert = Database["public"]["Tables"]["media"]["Insert"];

/**
 * The quota check happens here, before a single presigned URL is issued.
 *
 * Checking afterwards means the bytes are already in the bucket and already
 * billable. It also decides *what gets stored*, which is the whole compression
 * story: on an `optimised` event the browser's re-encoded copy becomes the
 * archival object and the phone never uploads the 4 MB original at all — which
 * is a quarter of the storage and, on venue wifi, a quarter of the wait.
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

    const prepared = body.files.map((file) => {
      const classified = classify(file.type);
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
      const mime = file.type.toLowerCase().split(";")[0].trim();
      const sourceFormat =
        classified.kind === "photo"
          ? imageFormatFromMime(mime)
          : videoFormatFromMime(mime);

      /* --- what do we actually keep? ------------------------------------- */

      // A photo can only drop its original if the browser produced a real
      // replacement. Video never can: the poster is not the video.
      const canReplaceOriginal =
        classified.kind === "photo" &&
        event.media_quality === "optimised" &&
        Boolean(file.display) &&
        !file.needsServer;

      const originalSource: OriginalSource = canReplaceOriginal
        ? "display"
        : "file";

      const archivalFormat: string = canReplaceOriginal
        ? file.display!.format
        : classified.ext;
      const archivalExt = canReplaceOriginal
        ? IMAGE_EXT[file.display!.format as ImageFormat]
        : classified.ext;
      const archivalBytes = canReplaceOriginal
        ? file.display!.size
        : file.size;
      const archivalMime = canReplaceOriginal
        ? IMAGE_MIME[file.display!.format as ImageFormat]
        : mime;

      /*
       * A separate display copy is kept when the archival object is not a good
       * thing to serve to two hundred guests — either because it is the full
       * uploaded original (heavy), or because it is a format half of them
       * cannot open (HEIC). When the archival object *is* the optimised copy,
       * a second one would be the same file twice.
       */
      const keepSeparateDisplay =
        !canReplaceOriginal &&
        Boolean(file.display) &&
        classified.kind === "photo";

      return {
        mediaId,
        kind: classified.kind,
        mime,
        sourceFormat,
        originalSource,
        archivalKey: originalKey(event.id, mediaId, archivalExt),
        archivalFormat,
        archivalBytes,
        archivalMime,
        display:
          keepSeparateDisplay && file.display
            ? {
                key: displayKey(
                  event.id,
                  mediaId,
                  IMAGE_EXT[file.display.format as ImageFormat],
                ),
                bytes: file.display.size,
                mime: IMAGE_MIME[file.display.format as ImageFormat],
                format: file.display.format,
              }
            : null,
        thumb: file.thumb
          ? {
              key: thumbKey(
                event.id,
                mediaId,
                IMAGE_EXT[file.thumb.format as ImageFormat],
              ),
              bytes: file.thumb.size,
              mime: IMAGE_MIME[file.thumb.format as ImageFormat],
              format: file.thumb.format,
            }
          : null,
        poster: file.poster
          ? {
              key: posterKey(
                event.id,
                mediaId,
                IMAGE_EXT[file.poster.format as ImageFormat],
              ),
              bytes: file.poster.size,
              mime: IMAGE_MIME[file.poster.format as ImageFormat],
              format: file.poster.format,
            }
          : null,
        width: file.sourceWidth ?? null,
        height: file.sourceHeight ?? null,
        durationSeconds: file.durationSeconds ?? null,
        originalReplaced: canReplaceOriginal,
        /*
         * The worker still owes us something when the browser could not decode
         * the file, or when it is a video that has not been transcoded to
         * something universally playable.
         */
        needsServer:
          file.needsServer ||
          classified.kind === "video" ||
          (classified.kind === "photo" &&
            !file.display &&
            sourceFormat !== null &&
            !isUniversallyViewable(sourceFormat as ImageFormat)),
      };
    });

    const totalBytes = prepared.reduce(
      (sum, f) =>
        sum +
        f.archivalBytes +
        (f.display?.bytes ?? 0) +
        (f.thumb?.bytes ?? 0) +
        (f.poster?.bytes ?? 0),
      0,
    );

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

    const rows: MediaInsert[] = prepared.map((f) => ({
      id: f.mediaId,
      event_id: event.id,
      original_key: f.archivalKey,
      display_key: f.display?.key ?? null,
      thumb_key: f.thumb?.key ?? null,
      poster_key: f.poster?.key ?? null,
      size_bytes: f.archivalBytes,
      display_size_bytes: f.display?.bytes ?? 0,
      thumb_size_bytes: f.thumb?.bytes ?? 0,
      poster_size_bytes: f.poster?.bytes ?? 0,
      original_format: f.archivalFormat,
      display_format: f.display?.format ?? null,
      thumb_format: f.thumb?.format ?? null,
      duration_seconds: f.durationSeconds,
      original_replaced: f.originalReplaced,
      processing: f.needsServer ? "pending" : "done",
      mime_type: f.archivalMime,
      kind: f.kind,
      width: f.width,
      height: f.height,
      uploader_fingerprint: body.fingerprint,
      uploader_name: body.uploaderName ?? null,
      status: "pending",
    }));

    const { error: insertError } = await admin.from("media").insert(rows);
    if (insertError) {
      await admin.rpc("release_storage", {
        p_event: event.id,
        p_bytes: totalBytes,
      });
      throw new Error(insertError.message);
    }

    // Tagged with the tier so the S3 lifecycle rules can filter on it.
    const tags = { tier: tier.id };

    const sign = (
      key: string,
      contentType: string,
      bytes: number,
      slack = 0,
    ): Promise<PresignedUpload> =>
      storage.presignUpload({
        key,
        contentType,
        maxBytes: Math.max(bytes + slack, 32 * 1024),
        tags,
      });

    const uploads = await Promise.all(
      prepared.map(async (f) => ({
        mediaId: f.mediaId,
        /** Which blob the client should send to `original`. */
        originalSource: f.originalSource,
        original: await sign(f.archivalKey, f.archivalMime, f.archivalBytes),
        display: f.display
          ? await sign(f.display.key, f.display.mime, f.display.bytes)
          : null,
        // Browser encoders are not byte-deterministic between the measuring
        // encode and the upload, so the signed ceiling carries some slack.
        thumb: f.thumb
          ? await sign(f.thumb.key, f.thumb.mime, f.thumb.bytes, 32 * 1024)
          : null,
        poster: f.poster
          ? await sign(f.poster.key, f.poster.mime, f.poster.bytes, 32 * 1024)
          : null,
      })),
    );

    return ok({ uploads });
  });
}
