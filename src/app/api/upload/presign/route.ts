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
  videoFormatFromMime,
} from "@/lib/formats";
import {
  MAX_FILES_PER_REQUEST,
  MAX_POSTER_BYTES,
  classify,
  mediaKey,
  posterKey,
  scopeOfEvent,
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
        /** The compressed copy the browser produced, if it managed one. */
        compressed: renditionSchema.optional().nullable(),
        poster: renditionSchema
          .extend({ size: z.number().int().positive().max(MAX_POSTER_BYTES) })
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

type MediaInsert = Database["public"]["Tables"]["media"]["Insert"];

/**
 * The quota check happens here, before a single presigned URL is issued.
 *
 * Checking afterwards means the bytes are already in the bucket and already
 * billable. It also decides *what gets stored*, and there is only ever one
 * answer now: the compressed copy. The phone never uploads the 4 MB original at
 * all - which is a quarter of the storage and, on venue wifi, a quarter of the
 * wait. Nobody is asked to choose, because "keep every original byte" is a
 * setting whose only effect is a bill four times larger for a difference nobody
 * can see on a screen.
 *
 * The one exception is a file the browser could not decode, chiefly HEIC
 * outside Safari. That goes up as it came off the phone and the worker replaces
 * the object with a compressed JPEG - so the event folder still ends up holding
 * compressed images only, just a minute later.
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
    // Every key this request signs is anchored to the host who owns the event,
    // never to anything the guest sent.
    const scope = scopeOfEvent(event);

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

      /* --- the one object we keep ---------------------------------------- */

      // A photo is stored compressed whenever the browser managed it. A video
      // is stored as uploaded until the worker replaces it with an MP4: the
      // poster is not the video, so there is nothing else to send.
      const useCompressed =
        classified.kind === "photo" &&
        Boolean(file.compressed) &&
        !file.needsServer;

      const format: string = useCompressed
        ? file.compressed!.format
        : (classified.kind === "photo"
            ? imageFormatFromMime(mime)
            : videoFormatFromMime(mime)) ?? classified.ext;
      const ext = useCompressed
        ? IMAGE_EXT[file.compressed!.format as ImageFormat]
        : classified.ext;
      const bytes = useCompressed ? file.compressed!.size : file.size;
      const contentType = useCompressed
        ? IMAGE_MIME[file.compressed!.format as ImageFormat]
        : mime;

      return {
        mediaId,
        kind: classified.kind,
        source: useCompressed ? ("compressed" as const) : ("file" as const),
        key: mediaKey(scope, mediaId, ext),
        format,
        bytes,
        contentType,
        poster:
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
            : null,
        width: file.sourceWidth ?? null,
        height: file.sourceHeight ?? null,
        durationSeconds: file.durationSeconds ?? null,
        /*
         * The worker still owes us something whenever the object in the bucket
         * is not already a compressed, universally viewable file: an image the
         * browser could not decode, or any video.
         */
        needsServer: !useCompressed,
      };
    });

    const totalBytes = prepared.reduce(
      (sum, f) => sum + f.bytes + (f.poster?.bytes ?? 0),
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
      media_key: f.key,
      poster_key: f.poster?.key ?? null,
      size_bytes: f.bytes,
      poster_size_bytes: f.poster?.bytes ?? 0,
      media_format: f.format,
      duration_seconds: f.durationSeconds,
      processing: f.needsServer ? "pending" : "done",
      mime_type: f.contentType,
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
      /*
       * The guest gets a generic 500, so this log line is the only place the
       * cause is visible. Naming the migration is not decoration: an insert
       * that names `media_key` against a database still on 0007 fails here and
       * nowhere else, and "upload stopped working" is indistinguishable from a
       * bucket problem until you read this.
       */
      throw new Error(
        `media insert failed (schema must be at migration 0008): ${insertError.message}`,
      );
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
        /** Which blob the client should send: the compressed copy, or the file. */
        source: f.source,
        media: await sign(f.key, f.contentType, f.bytes),
        // Browser encoders are not byte-deterministic between the measuring
        // encode and the upload, so the signed ceiling carries some slack.
        poster: f.poster
          ? await sign(f.poster.key, f.poster.mime, f.poster.bytes, 32 * 1024)
          : null,
      })),
    );

    return ok({ uploads });
  });
}
