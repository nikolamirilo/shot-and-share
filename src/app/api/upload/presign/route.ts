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
  /**
   * One file. The browser used to send the whole batch at once, which meant no
   * photo could start uploading until the slowest one had finished compressing;
   * a file at a time is what lets the two overlap.
   */
  file: z.object({
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
});

type ReservationInsert =
  Database["public"]["Tables"]["upload_reservations"]["Insert"];

/**
 * Reserve the space, sign the URL, and write down what to do when the bytes
 * arrive. One file per request.
 *
 * The quota check happens here, before a single presigned URL is issued.
 * Checking afterwards means the bytes are already in the bucket and already
 * billable. What it does *not* do any more is write to `media`: a media row now
 * means a photo that exists, and until the object lands there is only a
 * reservation - the promised bytes, the key they were promised for, and enough
 * detail to build the real row later. See migration 0010.
 *
 * It also decides what gets stored, and there is only ever one answer: the
 * compressed copy. The phone never uploads the 4 MB original at all - which is
 * a quarter of the storage and, on venue wifi, a quarter of the wait. Nobody is
 * asked to choose, because "keep every original byte" is a setting whose only
 * effect is a bill four times larger for a difference nobody can see on a
 * screen.
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

    const file = body.file;
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

    /* --- the one object we keep ------------------------------------------ */

    // A photo is stored compressed whenever the browser managed it. A video is
    // stored as uploaded until the worker replaces it with an MP4: the poster
    // is not the video, so there is nothing else to send.
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

    const key = mediaKey(scope, mediaId, ext);
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

    const totalBytes = bytes + (poster?.bytes ?? 0);

    /* --- the promise ------------------------------------------------------ */

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

    const reservation: ReservationInsert = {
      id: mediaId,
      event_id: event.id,
      owner_id: event.owner_id,
      media_key: key,
      poster_key: poster?.key ?? null,
      size_bytes: bytes,
      poster_size_bytes: poster?.bytes ?? 0,
      media: {
        kind: classified.kind,
        mime_type: contentType,
        media_format: format,
        duration_seconds: file.durationSeconds ?? null,
        width: file.sourceWidth ?? null,
        height: file.sourceHeight ?? null,
        /*
         * The worker still owes us something whenever the object in the bucket
         * is not already a compressed, universally viewable file: an image the
         * browser could not decode, or any video.
         */
        processing: useCompressed ? "done" : "pending",
        uploader_fingerprint: body.fingerprint,
        uploader_name: body.uploaderName || null,
      },
    };

    const { error: insertError } = await admin
      .from("upload_reservations")
      .insert(reservation);

    if (insertError) {
      await release(event.id, totalBytes);
      /*
       * The guest gets a generic 500, so this log line is the only place the
       * cause is visible. Naming the migration is not decoration: an insert
       * against a database still on 0009 fails here and nowhere else, and
       * "upload stopped working" is indistinguishable from a bucket problem
       * until you read this.
       */
      throw new Error(
        `reservation insert failed (schema must be at migration 0010): ${insertError.message}`,
      );
    }

    /* --- the signature ---------------------------------------------------- */

    // Tagged with the tier so the S3 lifecycle rules can filter on it.
    const tags = { tier: tier.id };

    const sign = (
      signKey: string,
      signType: string,
      signBytes: number,
      slack = 0,
    ): Promise<PresignedUpload> =>
      storage.presignUpload({
        key: signKey,
        contentType: signType,
        maxBytes: Math.max(signBytes + slack, 32 * 1024),
        tags,
      });

    try {
      const media = await sign(key, contentType, bytes);
      // Browser encoders are not byte-deterministic between the measuring
      // encode and the upload, so the signed ceiling carries some slack.
      const posterUpload = poster
        ? await sign(poster.key, poster.mime, poster.bytes, 32 * 1024)
        : null;

      return ok({
        upload: {
          mediaId,
          /** Which blob to send: the compressed copy, or the file itself. */
          source: useCompressed ? ("compressed" as const) : ("file" as const),
          media,
          poster: posterUpload,
        },
      });
    } catch (error) {
      /*
       * A signing failure used to leave both the row and the reserved bytes
       * behind - the rollback existed only on the insert path, and a bucket
       * that had lost its credentials would quietly eat a host's quota one
       * upload at a time. There is nothing for the guest to retry against, so
       * the promise is withdrawn before the error goes up.
       */
      await admin.from("upload_reservations").delete().eq("id", mediaId);
      await release(event.id, totalBytes);
      throw error;
    }
  });
}

/** Best effort: a refund that fails must not mask the error that caused it. */
async function release(eventId: string, bytes: number) {
  try {
    await createAdminClient().rpc("release_storage", {
      p_event: eventId,
      p_bytes: bytes,
    });
  } catch (error) {
    console.error("[presign] could not release reserved bytes", {
      eventId,
      bytes,
      error,
    });
  }
}
