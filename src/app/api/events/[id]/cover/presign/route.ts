import { randomUUID } from "node:crypto";
import { z } from "zod";

import { ApiError, fail, handle, ok, parseBody } from "@/lib/api";
import { storageSummary } from "@/lib/events";
import { formatBytes } from "@/lib/format";
import { enforceRateLimit } from "@/lib/guards";
import { requireOwnedEvent } from "@/lib/host";
import { mediaKey, scopeOfEvent, thumbKey } from "@/lib/media";
import { IMAGE_EXT, IMAGE_MIME, type ImageFormat } from "@/lib/media/formats";
import { LIMITS } from "@/lib/ratelimit";
import { getTier } from "@/lib/tiers";
import { classifyUpload, decideStoredObject } from "@/lib/uploads/classify";
import { createReservation } from "@/lib/uploads/reservation";
import { fileSchema } from "@/lib/uploads/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The guest presign shape minus the poster: a cover is a still image. */
const bodySchema = z.object({ file: fileSchema });

/**
 * A cover image the host uploaded themselves.
 *
 * The guest handshake with the token swapped for a session, landing in the same
 * place, reserved against the same quota, confirmed into the same table. Only
 * `source` differs, and the confirm sets that - see migration 0013 for why a
 * cover is kept out of the gallery.
 *
 * Photos only. Accepting a video here would mean either storing one nobody
 * plays or transcoding one to take a frame off it, and the picker already lets
 * a host pick any video's poster out of the event.
 */
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
    // The appearance form is behind the same paywall and this endpoint is not
    // reachable from it, so this is about the request nobody made through the
    // interface.
    if (!tier.customPage) {
      throw new ApiError(
        "forbidden",
        "Your own cover image is on Roll and Reel.",
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

    // The cover picker renders the same grid the gallery does, so it wants the
    // same small copy.
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
      key: mediaKey(scope, mediaId, stored.ext),
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
        /*
         * No fingerprint, and it is load-bearing. A null fingerprint is what
         * the guest confirm compares against and always fails, so this
         * reservation cannot be turned into a guest photo by anyone holding the
         * share link - and it is what the cover confirm checks to be sure it is
         * finishing an upload this endpoint started.
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
        /** Which blob to send: the compressed copy, or the file itself. */
        source: stored.useCompressed
          ? ("compressed" as const)
          : ("file" as const),
        media: result.media,
        thumb: result.thumb,
      },
    });
  });
}
