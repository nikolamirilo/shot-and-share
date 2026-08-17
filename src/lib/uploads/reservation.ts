import "server-only";

import type { Database, EventRow, ReservedMedia } from "@/lib/db/types";
import { storage } from "@/lib/storage";
import type { PresignedUpload } from "@/lib/storage/types";
import { release, reserve } from "@/lib/storage/quota";
import { createAdminClient } from "@/lib/supabase/admin";

type ReservationInsert =
  Database["public"]["Tables"]["upload_reservations"]["Insert"];

/** A second object to sign beside the media: only ever a video's poster. */
export interface PosterTarget {
  key: string;
  bytes: number;
  mime: string;
}

/** The small copy for the grid, signed beside the photo it belongs to. */
export interface ThumbTarget {
  key: string;
  bytes: number;
  mime: string;
}

export interface ReservationRequest {
  event: Pick<EventRow, "id" | "owner_id">;
  mediaId: string;
  key: string;
  contentType: string;
  bytes: number;
  thumb: ThumbTarget | null;
  poster: PosterTarget | null;
  media: ReservedMedia;
  /** Tagged on the object so the S3 lifecycle rules can filter on it. */
  tierId: string;
  /**
   * Headroom on the signed ceiling for the media object. Browser encoders are
   * not byte-deterministic between the measuring encode and the upload. The
   * cover route has always allowed for that and the guest route has not; the
   * difference is preserved here rather than quietly unified.
   */
  slack?: number;
}

export type ReservationResult =
  | {
      ok: true;
      media: PresignedUpload;
      thumb: PresignedUpload | null;
      poster: PresignedUpload | null;
    }
  | { ok: false; reason: "quota" };

/**
 * Reserve the space, write down what to do when the bytes arrive, and sign the
 * URLs. One file per call.
 *
 * The quota check happens before a single URL is issued. Checking afterwards
 * means the bytes are already in the bucket and already billable.
 *
 * What it does not do is write to `media`: a media row means a photo that
 * exists, and until the object lands there is only a reservation - the promised
 * bytes, the key they were promised for, and enough detail to build the real
 * row later. See migration 0010.
 *
 * Every failure after the reservation is charged for undoes it, signing
 * included - otherwise a bucket that has lost its credentials quietly eats a
 * host's quota one upload at a time.
 */
export async function createReservation(
  request: ReservationRequest,
): Promise<ReservationResult> {
  const { event, mediaId, poster, thumb } = request;
  const totalBytes = request.bytes + (thumb?.bytes ?? 0) + (poster?.bytes ?? 0);

  if (!(await reserve(event.id, totalBytes))) {
    return { ok: false, reason: "quota" };
  }

  const row: ReservationInsert = {
    id: mediaId,
    event_id: event.id,
    owner_id: event.owner_id,
    media_key: request.key,
    thumb_key: thumb?.key ?? null,
    poster_key: poster?.key ?? null,
    size_bytes: request.bytes,
    thumb_size_bytes: thumb?.bytes ?? 0,
    poster_size_bytes: poster?.bytes ?? 0,
    media: request.media,
  };

  const admin = createAdminClient();
  const { error: insertError } = await admin
    .from("upload_reservations")
    .insert(row);

  if (insertError) {
    await release(event.id, totalBytes);
    // The guest gets a generic 500, so this is the only place the cause is
    // visible. Naming the migration is not decoration: an insert against a
    // database still on 0009 fails here and nowhere else.
    throw new Error(
      `reservation insert failed (schema must be at migration 0010): ${insertError.message}`,
    );
  }

  try {
    const media = await sign(
      request.key,
      request.contentType,
      request.bytes,
      request.tierId,
      request.slack ?? 0,
    );
    // 8 KB of slack: a browser encoder is not byte-deterministic between the
    // measuring encode and the upload, and at 25 KB a percentage would be
    // smaller than that wobble.
    const thumbUpload = thumb
      ? await sign(thumb.key, thumb.mime, thumb.bytes, request.tierId, 8 * 1024)
      : null;
    const posterUpload = poster
      ? await sign(poster.key, poster.mime, poster.bytes, request.tierId, 32 * 1024)
      : null;

    return { ok: true, media, thumb: thumbUpload, poster: posterUpload };
  } catch (error) {
    await admin.from("upload_reservations").delete().eq("id", mediaId);
    await release(event.id, totalBytes);
    throw error;
  }
}

function sign(
  key: string,
  contentType: string,
  bytes: number,
  tierId: string,
  slack = 0,
): Promise<PresignedUpload> {
  return storage.presignUpload({
    key,
    contentType,
    maxBytes: Math.max(bytes + slack, 32 * 1024),
    tags: { tier: tierId },
  });
}
