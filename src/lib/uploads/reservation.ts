import "server-only";

import { type Database, type EventRow, type ReservedMedia } from "@/types/db";
import { storage } from "@/lib/storage";
import {
  IMMUTABLE_CACHE_CONTROL,
  type PresignedUpload,
} from "@/lib/storage/types";
import { release, reserve } from "@/lib/storage/quota";
import { createAdminClient } from "@/lib/supabase/admin";

type ReservationInsert =
  Database["public"]["Tables"]["upload_reservations"]["Insert"];

export interface PosterTarget {
  key: string;
  bytes: number;
  mime: string;
}

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
  tierId: string;
  /**
   * Headroom on the signed ceiling: browser encoders are not byte-deterministic between
   * the measuring encode and the upload.
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
    // 8 KB of slack, not a percentage: at 25 KB a percentage is smaller than the
    // encoder's own wobble.
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
    cacheControl: IMMUTABLE_CACHE_CONTROL,
  });
}
