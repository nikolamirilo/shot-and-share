import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import type { Database, MediaRow, ReservedMedia } from "@/lib/db/types";
import { toMediaView } from "@/lib/events";
import { requireOwnedEvent } from "@/lib/host";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mediaId: z.string().uuid(),
  width: z.number().int().positive().max(60_000).nullable().optional(),
  height: z.number().int().positive().max(60_000).nullable().optional(),
  /** Whether the signed object actually made it into the bucket. */
  mediaUploaded: z.boolean().default(true),
  failed: z.boolean().default(false),
});

type MediaInsert = Database["public"]["Tables"]["media"]["Insert"];

/**
 * Second half of the cover handshake: the bytes are in the bucket, so the row
 * gets written - with `source = 'cover'`, which is what keeps the host's own
 * picture out of the gallery, the slideshow, the ZIP and the photo count.
 *
 * The row comes back in the response. The picker has to show the new cover the
 * moment it lands, and re-rendering the whole console to fetch one thumbnail
 * would throw away the unsaved edits sitting in the panel around it.
 *
 * Safe to call twice, like the guest confirm: losing the image because a small
 * acknowledgement did not get through would be the worst trade available.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const event = await requireOwnedEvent(id);
    const body = await parseBody(request, bodySchema);
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
      // nightly sweep reclaimed it. Which one decides what comes back, so look
      // rather than guess.
      const { data: existing } = await admin
        .from("media")
        .select("*")
        .eq("id", body.mediaId)
        .eq("event_id", event.id)
        .maybeSingle();

      return ok({
        confirmed: Boolean(existing),
        item: existing ? await toMediaView(existing as MediaRow) : null,
      });
    }

    const media = reservation.media as ReservedMedia;

    /*
     * A cover reservation is the only one with no fingerprint on it. Without
     * this check a host could hand this endpoint the id of a guest's in-flight
     * upload and have the guest's photograph written in as their cover - and
     * with `source = 'cover'` it would then vanish from the gallery the guest
     * uploaded it to.
     */
    if (media.uploader_fingerprint !== null) {
      return ok({ confirmed: false, item: null });
    }

    const bytes = Number(reservation.size_bytes);

    if (body.failed || !body.mediaUploaded) {
      await discard(reservation.id);
      await release(event.id, bytes);
      return ok({ confirmed: false, item: null });
    }

    const row: MediaInsert = {
      id: reservation.id,
      event_id: reservation.event_id,
      media_key: reservation.media_key,
      poster_key: null,
      size_bytes: reservation.size_bytes,
      poster_size_bytes: 0,
      media_format: media.media_format,
      duration_seconds: null,
      processing: media.processing,
      mime_type: media.mime_type,
      kind: "photo",
      width: body.width ?? media.width,
      height: body.height ?? media.height,
      uploader_fingerprint: null,
      uploader_name: null,
      source: "cover",
      status: "ready",
    };

    const { error: insertError } = await admin.from("media").insert(row);

    if (insertError) {
      // A duplicate key means a previous attempt got further than it managed to
      // report. The image is already there; finish tidying up and say so.
      if (isDuplicate(insertError)) {
        await discard(reservation.id);
        const { data: existing } = await admin
          .from("media")
          .select("*")
          .eq("id", reservation.id)
          .maybeSingle();
        return ok({
          confirmed: Boolean(existing),
          item: existing ? await toMediaView(existing as MediaRow) : null,
        });
      }
      // Anything else leaves the reservation where it is, on purpose: the
      // browser can retry against it, and the nightly sweep is the backstop.
      throw new Error(`cover insert failed: ${insertError.message}`);
    }

    await discard(reservation.id);

    const { data: saved } = await admin
      .from("media")
      .select("*")
      .eq("id", reservation.id)
      .maybeSingle();

    return ok({
      confirmed: true,
      item: saved ? await toMediaView(saved as MediaRow) : null,
    });
  });
}

/* -------------------------------------------------------------------------- */

async function discard(id: string) {
  const { error } = await createAdminClient()
    .from("upload_reservations")
    .delete()
    .eq("id", id);

  // Not fatal, and deliberately not thrown. The media row is already written,
  // and the sweep skips any reservation whose photo exists.
  if (error) {
    console.error("[cover] could not delete reservation", { id, error });
  }
}

async function release(eventId: string, bytes: number) {
  if (bytes <= 0) return;
  const { error } = await createAdminClient().rpc("release_storage", {
    p_event: eventId,
    p_bytes: bytes,
  });
  if (error) {
    console.error("[cover] could not release bytes", { eventId, bytes, error });
  }
}

/** Postgres unique violation, however the client happens to surface it. */
function isDuplicate(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}
