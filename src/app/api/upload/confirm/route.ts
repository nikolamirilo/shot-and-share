import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import type { Database, ReservedMedia } from "@/lib/db/types";
import { requireGuestEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  fingerprint: z.string().min(8).max(64),
  mediaId: z.string().uuid(),
  width: z.number().int().positive().max(60_000).nullable().optional(),
  height: z.number().int().positive().max(60_000).nullable().optional(),
  /** Which of the signed objects actually made it into the bucket. */
  mediaUploaded: z.boolean().default(true),
  posterUploaded: z.boolean().default(false),
  failed: z.boolean().default(false),
  /**
   * Why the browser gave up, in the app's own words.
   *
   * The upload goes straight from the phone to the bucket, so when it fails
   * there is no request on our side to look at: presign answers 200, confirm
   * arrives seconds later saying it did not work, and the reason exists only in
   * a console nobody is reading. A bucket whose CORS rules do not name the live
   * hostname looks exactly like a guest on bad wifi from here, and the two need
   * completely different repairs.
   */
  reason: z.string().max(300).optional(),
});

type MediaInsert = Database["public"]["Tables"]["media"]["Insert"];

/**
 * Second half of the upload handshake, one file at a time: the bytes are in the
 * bucket, so the row gets written.
 *
 * This is the only place a media row is created. Nothing exists in `media`
 * until its object does, which is what makes the table readable without a
 * status filter and what stops a failed upload from being counted against a
 * host's quota as though it had worked.
 *
 * A video's poster is confirmed separately from the video, because they fail
 * separately. A poster that did not upload is a cosmetic problem; the clip is
 * still there, and the worker will cut a new frame. What matters is that any
 * object which did *not* arrive has its reserved bytes handed straight back, or
 * the host slowly loses quota to uploads that never happened.
 *
 * Safe to call twice. The browser retries a confirm that failed on a flaky
 * connection - the bytes are already in the bucket by then, and losing the
 * photo because the four hundred byte acknowledgement did not get through
 * would be the worst trade in the system.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    const { event } = await requireGuestEvent(body.token);
    const admin = createAdminClient();

    const { data: reservation, error: readError } = await admin
      .from("upload_reservations")
      .select("*")
      .eq("id", body.mediaId)
      .eq("event_id", event.id)
      .maybeSingle();

    if (readError) throw new Error(readError.message);

    if (!reservation) {
      // Either this call already succeeded and the browser is retrying, or the
      // nightly sweep reclaimed it. Which one decides what the guest is told,
      // so look rather than guess.
      const { data: existing } = await admin
        .from("media")
        .select("id")
        .eq("id", body.mediaId)
        .eq("event_id", event.id)
        .maybeSingle();

      return ok({ confirmed: Boolean(existing) });
    }

    const media = reservation.media as ReservedMedia;

    // The fingerprint is the only thing tying a reservation to the guest who
    // asked for it. It is not authentication - it is what stops one guest's
    // browser confirming another's upload by guessing a uuid.
    if (media.uploader_fingerprint !== body.fingerprint) {
      return ok({ confirmed: false });
    }

    const totalBytes =
      Number(reservation.size_bytes) + Number(reservation.poster_size_bytes);

    /* --- nothing arrived -------------------------------------------------- */

    // The stored object is the photo. Without it there is nothing to keep, so
    // the whole promise goes back, poster and all.
    if (body.failed || !body.mediaUploaded) {
      /*
       * The only record that this upload was attempted at all. Everything else
       * about a failure between the phone and the bucket is invisible to us,
       * and one of the causes - CORS rules that have gone stale after a rename
       * - takes down every upload at every event at once while leaving the
       * logs looking entirely healthy.
       */
      console.error("[confirm] upload did not reach storage", {
        eventId: event.id,
        mediaKey: reservation.media_key,
        bytes: totalBytes,
        reason: body.reason ?? "not reported",
      });
      await discard(reservation.id);
      await release(event.id, totalBytes);
      return ok({ confirmed: false });
    }

    /* --- the row ---------------------------------------------------------- */

    const posterOk = body.posterUploaded && Boolean(reservation.poster_key);

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
      width: body.width ?? media.width,
      height: body.height ?? media.height,
      uploader_fingerprint: media.uploader_fingerprint,
      uploader_name: media.uploader_name,
      status: "ready",
    };

    const { error: insertError } = await admin.from("media").insert(row);

    if (insertError) {
      /*
       * A duplicate key means a previous attempt got further than it managed to
       * report. The photo is already there; finish tidying up and say so.
       */
      if (isDuplicate(insertError)) {
        await discard(reservation.id);
        return ok({ confirmed: true });
      }
      /*
       * Anything else leaves the reservation exactly where it is, on purpose.
       * The browser can retry against it, and if the guest has gone the nightly
       * sweep hands the bytes back - both of which are impossible once the
       * reservation is deleted.
       */
      throw new Error(`media insert failed: ${insertError.message}`);
    }

    // Only now that the photo is a row does the promise get torn up.
    await discard(reservation.id);

    // A poster that never arrived was still charged for at presign time.
    if (!posterOk && Number(reservation.poster_size_bytes) > 0) {
      await release(event.id, Number(reservation.poster_size_bytes));
    }

    return ok({ confirmed: true });
  });
}

/* -------------------------------------------------------------------------- */

async function discard(id: string) {
  const { error } = await createAdminClient()
    .from("upload_reservations")
    .delete()
    .eq("id", id);

  /*
   * Not fatal, and deliberately not thrown. The media row is already written,
   * and the sweep skips any reservation whose photo exists - so a reservation
   * left behind here costs a row until tomorrow and nothing else.
   */
  if (error) {
    console.error("[confirm] could not delete reservation", { id, error });
  }
}

async function release(eventId: string, bytes: number) {
  if (bytes <= 0) return;
  const { error } = await createAdminClient().rpc("release_storage", {
    p_event: eventId,
    p_bytes: bytes,
  });
  if (error) {
    console.error("[confirm] could not release bytes", {
      eventId,
      bytes,
      error,
    });
  }
}

/** Postgres unique violation, however the client happens to surface it. */
function isDuplicate(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "23505" || /duplicate key/i.test(error.message ?? "")
  );
}
