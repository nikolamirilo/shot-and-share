import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { requireGuestEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  fingerprint: z.string().min(8).max(64),
  items: z
    .array(
      z.object({
        mediaId: z.string().uuid(),
        width: z.number().int().positive().max(60_000).nullable().optional(),
        height: z.number().int().positive().max(60_000).nullable().optional(),
        /** Which of the signed objects actually made it into the bucket. */
        mediaUploaded: z.boolean().default(true),
        posterUploaded: z.boolean().default(false),
        failed: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(60),
});

/**
 * Second half of the upload handshake: the bytes are in the bucket, so the rows
 * become real.
 *
 * A video's poster is confirmed separately from the video, because they fail
 * separately. A poster that did not upload is a cosmetic problem; the clip is
 * still there, and the worker will cut a new frame. What matters is that any
 * object which did *not* arrive has its reserved bytes handed straight back, or
 * the host slowly loses quota to uploads that never happened.
 *
 * A row that is never confirmed at all stays `pending` and the nightly job
 * sweeps it - a guest whose phone dies mid-upload costs the host nothing.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    const { event } = await requireGuestEvent(body.token);
    const admin = createAdminClient();

    const ids = body.items.map((i) => i.mediaId);
    const { data: rows, error } = await admin
      .from("media")
      .select("*")
      .eq("event_id", event.id)
      .eq("status", "pending")
      .eq("uploader_fingerprint", body.fingerprint)
      .in("id", ids);

    if (error) throw new Error(error.message);
    const pending = new Map((rows ?? []).map((r) => [r.id, r]));

    let confirmed = 0;
    let released = 0;

    for (const item of body.items) {
      const row = pending.get(item.mediaId);
      if (!row) continue;

      // The stored object is the photo. Without it there is nothing to keep,
      // so the whole row goes back, poster and all.
      if (item.failed || !item.mediaUploaded) {
        await admin.from("media").update({ status: "deleted" }).eq("id", row.id);
        released += Number(row.size_bytes) + Number(row.poster_size_bytes);
        continue;
      }

      const posterOk = item.posterUploaded && Boolean(row.poster_key);
      if (!posterOk) released += Number(row.poster_size_bytes);

      await admin
        .from("media")
        .update({
          status: "ready",
          width: item.width ?? row.width,
          height: item.height ?? row.height,
          poster_key: posterOk ? row.poster_key : null,
          poster_size_bytes: posterOk ? row.poster_size_bytes : 0,
        })
        .eq("id", row.id);
      confirmed += 1;
    }

    if (released > 0) {
      await admin.rpc("release_storage", {
        p_event: event.id,
        p_bytes: released,
      });
    }

    return ok({ confirmed });
  });
}
