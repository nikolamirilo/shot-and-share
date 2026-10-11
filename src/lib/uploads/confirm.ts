import "server-only";

import { mediaExists } from "@/lib/db/media-repo";
import type {
  Database,
  MediaSource,
  ReservedMedia,
  UploadReservationRow,
} from "@/types/db";
import { decideReview, screenableKey } from "@/lib/moderation/review";
import { release } from "@/lib/storage/quota";
import { createAdminClient } from "@/lib/supabase/admin";

type MediaInsert = Database["public"]["Tables"]["media"]["Insert"];

export interface ConfirmRequest {
  eventId: string;
  mediaId: string;
  source: MediaSource;
  claim: (media: ReservedMedia) => boolean;
  mediaUploaded: boolean;
  posterUploaded: boolean;
  thumbUploaded: boolean;
  width?: number | null;
  height?: number | null;
  reason?: string;
  log: string;
  requireApproval?: boolean;
  autoScan?: boolean;
}

export type ConfirmResult =
  | { confirmed: true; held?: boolean }
  | { confirmed: false; because: "refused" | "gone" | "failed" };

export async function confirmReservation(
  request: ConfirmRequest,
): Promise<ConfirmResult> {
  const admin = createAdminClient();
  const { eventId, mediaId } = request;

  const { data, error: readError } = await admin
    .from("upload_reservations")
    .select("*")
    .eq("id", mediaId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  if (!data) {
    // Either this call already succeeded and the browser is retrying, or the nightly
    // sweep reclaimed it - so look rather than guess.
    return (await mediaExists(admin, { id: mediaId, eventId }))
      ? { confirmed: true }
      : { confirmed: false, because: "gone" };
  }

  const reservation = data as UploadReservationRow;
  const media = reservation.media as ReservedMedia;

  if (!request.claim(media)) {
    return { confirmed: false, because: "refused" };
  }

  const totalBytes =
    Number(reservation.size_bytes) +
    Number(reservation.thumb_size_bytes) +
    Number(reservation.poster_size_bytes);

  if (!request.mediaUploaded) {
    console.error(`[${request.log}] upload did not reach storage`, {
      eventId,
      mediaKey: reservation.media_key,
      bytes: totalBytes,
      reason: request.reason ?? "not reported",
    });
    await discard(request.log, reservation.id);
    await release(eventId, totalBytes);
    return { confirmed: false, because: "failed" };
  }

  const posterOk = request.posterUploaded && Boolean(reservation.poster_key);
  const thumbOk = request.thumbUploaded && Boolean(reservation.thumb_key);

  const row: MediaInsert = {
    id: reservation.id,
    event_id: reservation.event_id,
    media_key: reservation.media_key,
    thumb_key: thumbOk ? reservation.thumb_key : null,
    poster_key: posterOk ? reservation.poster_key : null,
    size_bytes: reservation.size_bytes,
    thumb_size_bytes: thumbOk ? reservation.thumb_size_bytes : 0,
    poster_size_bytes: posterOk ? reservation.poster_size_bytes : 0,
    media_format: media.media_format,
    thumb_format: thumbOk ? media.thumb_format : null,
    duration_seconds: media.duration_seconds,
    processing: media.processing,
    mime_type: media.mime_type,
    kind: media.kind,
    width: request.width ?? media.width,
    height: request.height ?? media.height,
    uploader_fingerprint: media.uploader_fingerprint,
    taken_at: media.taken_at ?? null,
    source: request.source,
    status: "ready",
  };

  const review = await decideReview({
    key: screenableKey({
      kind: row.kind,
      media_key: row.media_key,
      poster_key: row.poster_key ?? null,
    }),
    requireApproval: request.requireApproval ?? false,
    autoScan: request.autoScan ?? false,
  });

  if (review.review_state === "held") {
    console.warn(`[${request.log}] held for review`, {
      eventId,
      mediaId: reservation.id,
      labels: review.moderation_labels?.map((label) => label.name) ?? [],
    });
  }

  const { error: insertError } = await admin
    .from("media")
    .insert({ ...row, ...review });

  if (insertError) {
    // A duplicate key means a previous attempt got further than it reported.
    if (isDuplicate(insertError)) {
      await discard(request.log, reservation.id);
      return { confirmed: true };
    }
    throw new Error(`media insert failed: ${insertError.message}`);
  }

  await discard(request.log, reservation.id);

  if (!posterOk) {
    await release(eventId, Number(reservation.poster_size_bytes));
  }
  if (!thumbOk) {
    await release(eventId, Number(reservation.thumb_size_bytes));
  }

  return { confirmed: true, held: review.review_state === "held" };
}

async function discard(log: string, id: string) {
  const { error } = await createAdminClient()
    .from("upload_reservations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(`[${log}] could not delete reservation`, { id, error });
  }
}

// Postgres unique violation, however the client happens to surface it.
function isDuplicate(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}
