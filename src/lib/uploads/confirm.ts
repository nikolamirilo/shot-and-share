import "server-only";

import { mediaExists } from "@/lib/db/media-repo";
import type {
  Database,
  MediaSource,
  ReservedMedia,
  UploadReservationRow,
} from "@/lib/db/types";
import { release } from "@/lib/storage/quota";
import { createAdminClient } from "@/lib/supabase/admin";

type MediaInsert = Database["public"]["Tables"]["media"]["Insert"];

export interface ConfirmRequest {
  eventId: string;
  mediaId: string;
  source: MediaSource;
  /**
   * Proves the caller is the one who reserved this. A guest matches the
   * fingerprint they presigned with; the cover route requires there to be no
   * fingerprint at all, which is what stops a host turning a guest's in-flight
   * upload into their own cover image.
   */
  claim: (media: ReservedMedia) => boolean;
  mediaUploaded: boolean;
  posterUploaded: boolean;
  width?: number | null;
  height?: number | null;
  /** Why the browser gave up, for the log. Only the guest route sends one. */
  reason?: string;
  /** Prefix for the log lines, so a failure names the side it came from. */
  log: string;
}

export type ConfirmResult =
  | { confirmed: true }
  | { confirmed: false; because: "refused" | "gone" | "failed" };

/**
 * Second half of the upload handshake: the bytes are in the bucket, so the row
 * gets written.
 *
 * This is the only place a media row is created. Nothing exists in `media`
 * until its object does, which is what makes the table readable without a
 * status filter and what stops a failed upload from being counted against a
 * host's quota as though it had worked.
 *
 * Safe to call twice. The browser retries a confirm that failed on a flaky
 * connection - the bytes are already in the bucket by then, and losing the
 * photo because a four hundred byte acknowledgement did not get through would
 * be the worst trade in the system.
 */
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
    // Either this call already succeeded and the browser is retrying, or the
    // nightly sweep reclaimed it. Which one decides what the caller is told,
    // so look rather than guess.
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
    Number(reservation.size_bytes) + Number(reservation.poster_size_bytes);

  // The stored object is the photo. Without it there is nothing to keep, so
  // the whole promise goes back, poster and all.
  if (!request.mediaUploaded) {
    /*
     * The only record that this upload was attempted at all. Everything else
     * about a failure between the phone and the bucket is invisible to us, and
     * one of the causes - CORS rules gone stale after a rename - takes down
     * every upload at every event at once while the logs look healthy.
     */
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

  const row: MediaInsert = {
    id: reservation.id,
    event_id: reservation.event_id,
    media_key: reservation.media_key,
    poster_key: posterOk ? reservation.poster_key : null,
    size_bytes: reservation.size_bytes,
    poster_size_bytes: posterOk ? reservation.poster_size_bytes : 0,
    media_format: media.media_format,
    duration_seconds: media.duration_seconds,
    processing: media.processing,
    mime_type: media.mime_type,
    kind: media.kind,
    width: request.width ?? media.width,
    height: request.height ?? media.height,
    uploader_fingerprint: media.uploader_fingerprint,
    uploader_name: media.uploader_name,
    source: request.source,
    status: "ready",
  };

  const { error: insertError } = await admin.from("media").insert(row);

  if (insertError) {
    // A duplicate key means a previous attempt got further than it managed to
    // report. The photo is already there; finish tidying up and say so.
    if (isDuplicate(insertError)) {
      await discard(request.log, reservation.id);
      return { confirmed: true };
    }
    /*
     * Anything else leaves the reservation exactly where it is, on purpose. The
     * browser can retry against it, and if the guest has gone the nightly sweep
     * hands the bytes back - both impossible once it is deleted.
     */
    throw new Error(`media insert failed: ${insertError.message}`);
  }

  // Only now that the photo is a row does the promise get torn up.
  await discard(request.log, reservation.id);

  // A poster that never arrived was still charged for at presign time.
  if (!posterOk) {
    await release(eventId, Number(reservation.poster_size_bytes));
  }

  return { confirmed: true };
}

async function discard(log: string, id: string) {
  const { error } = await createAdminClient()
    .from("upload_reservations")
    .delete()
    .eq("id", id);

  // Not fatal, and deliberately not thrown. The media row is already written,
  // and the sweep skips any reservation whose photo exists - so one left behind
  // here costs a row until tomorrow and nothing else.
  if (error) {
    console.error(`[${log}] could not delete reservation`, { id, error });
  }
}

/** Postgres unique violation, however the client happens to surface it. */
function isDuplicate(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}
