import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ApiError, fail, handle, ok, parseBody } from "@/lib/api";
import type { Database } from "@/lib/db/types";
import { storageSummary } from "@/lib/events";
import { formatBytes } from "@/lib/format";
import {
  IMAGE_EXT,
  IMAGE_MIME,
  type ImageFormat,
  imageFormatFromMime,
} from "@/lib/formats";
import { requireOwnedEvent } from "@/lib/host";
import { classify, mediaKey, scopeOfEvent } from "@/lib/media";
import { LIMITS, rateLimit } from "@/lib/ratelimit";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTier } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The same shape the guest presign takes, minus the poster: a cover is a still
 * image, so there is never a second object to sign.
 */
const bodySchema = z.object({
  file: z.object({
    size: z.number().int().positive(),
    type: z.string().min(3).max(120),
    /** The compressed copy the browser produced, if it managed one. */
    compressed: z
      .object({
        size: z.number().int().positive(),
        format: z.enum(["webp", "jpeg", "avif", "png"]),
        width: z.number().int().positive().max(60_000).optional(),
        height: z.number().int().positive().max(60_000).optional(),
      })
      .optional()
      .nullable(),
    sourceWidth: z.number().int().positive().max(60_000).optional().nullable(),
    sourceHeight: z.number().int().positive().max(60_000).optional().nullable(),
    /** The browser could not decode it; the worker has to finish the job. */
    needsServer: z.boolean().default(false),
  }),
});

type ReservationInsert =
  Database["public"]["Tables"]["upload_reservations"]["Insert"];

/**
 * A cover image the host uploaded themselves.
 *
 * It is the guest handshake with the token swapped for a session, and it lands
 * in the same place: `{owner}/{event}/{id}.{ext}`, reserved against the same
 * quota, confirmed into the same table. Only `source` differs, and that is set
 * by the confirm - see migration 0013 for why a cover is kept out of the
 * gallery.
 *
 * Photos only. A cover is the still frame at the top of the page, so accepting
 * a video here would mean either storing one nobody plays or transcoding one to
 * take a frame off it, and the picker already lets a host pick any video's
 * poster out of the event.
 *
 * The paywall check is the same one the appearance form is behind. The form is
 * an upsell on the free plan and this endpoint is not reachable from it, so
 * refusing here is about the request nobody made through the UI.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const event = await requireOwnedEvent(id);

    const limit = rateLimit(
      `cover:${event.id}`,
      LIMITS.coverUpload.limit,
      LIMITS.coverUpload.window,
    );
    if (!limit.ok) {
      return fail("rate_limited", "That is a lot of covers at once.", {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const tier = getTier(event.tier);
    if (!tier.customPage) {
      throw new ApiError(
        "forbidden",
        "Your own cover image is on Slice and Wheel.",
        { upgrade: true },
      );
    }

    const body = await parseBody(request, bodySchema);
    const file = body.file;

    const classified = classify(file.type);
    if (!classified || classified.kind !== "photo") {
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
    const mime = file.type.toLowerCase().split(";")[0].trim();
    const scope = scopeOfEvent(event);

    // The compressed copy is the photo, exactly as it is for a guest. The one
    // exception is a file the browser could not decode - chiefly HEIC outside
    // Safari - which goes up as it came off the disk for the worker to replace.
    const useCompressed = Boolean(file.compressed) && !file.needsServer;

    const format: string = useCompressed
      ? file.compressed!.format
      : imageFormatFromMime(mime) ?? classified.ext;
    const ext = useCompressed
      ? IMAGE_EXT[file.compressed!.format as ImageFormat]
      : classified.ext;
    const bytes = useCompressed ? file.compressed!.size : file.size;
    const contentType = useCompressed
      ? IMAGE_MIME[file.compressed!.format as ImageFormat]
      : mime;

    const key = mediaKey(scope, mediaId, ext);

    const admin = createAdminClient();
    const { data: reserved, error: reserveError } = await admin.rpc(
      "reserve_storage",
      { p_event: event.id, p_bytes: bytes },
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
      poster_key: null,
      size_bytes: bytes,
      poster_size_bytes: 0,
      media: {
        kind: "photo",
        mime_type: contentType,
        media_format: format,
        duration_seconds: null,
        width: file.sourceWidth ?? null,
        height: file.sourceHeight ?? null,
        processing: useCompressed ? "done" : "pending",
        /*
         * No fingerprint and no name, and both are load-bearing rather than
         * absent for want of a value. A null fingerprint is what the guest
         * confirm compares against and always fails, so this reservation cannot
         * be turned into a guest photo by anyone holding the share link - and
         * it is what the cover confirm checks to be sure it is finishing an
         * upload this endpoint started.
         */
        uploader_fingerprint: null,
        uploader_name: null,
      },
    };

    const { error: insertError } = await admin
      .from("upload_reservations")
      .insert(reservation);

    if (insertError) {
      await release(event.id, bytes);
      throw new Error(`reservation insert failed: ${insertError.message}`);
    }

    try {
      const media = await storage.presignUpload({
        key,
        contentType,
        // Browser encoders are not byte-deterministic between the measuring
        // encode and the upload, so the signed ceiling carries some slack.
        maxBytes: Math.max(bytes + 32 * 1024, 32 * 1024),
        tags: { tier: tier.id },
      });

      return ok({
        upload: {
          mediaId,
          /** Which blob to send: the compressed copy, or the file itself. */
          source: useCompressed ? ("compressed" as const) : ("file" as const),
          media,
        },
      });
    } catch (error) {
      // Nothing for the host to retry against, so the promise is withdrawn
      // before the error goes up rather than eating their quota until the sweep.
      await admin.from("upload_reservations").delete().eq("id", mediaId);
      await release(event.id, bytes);
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
    console.error("[cover] could not release reserved bytes", {
      eventId,
      bytes,
      error,
    });
  }
}
