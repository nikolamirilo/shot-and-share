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
        thumbUploaded: z.boolean().default(false),
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
 * A row that never gets confirmed stays `pending` and is swept by the retention
 * job, which also gives its reserved quota back. That is the failure mode we
 * want — a guest whose phone dies mid-upload costs the host nothing permanent.
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

      if (item.failed) {
        await admin
          .from("media")
          .update({ status: "deleted" })
          .eq("id", row.id);
        released += Number(row.size_bytes) + Number(row.thumb_size_bytes);
        continue;
      }

      // A thumbnail that failed to generate is not a failed upload. The gallery
      // falls back to the original; only the reserved bytes come back.
      const thumbOk = item.thumbUploaded && Boolean(row.thumb_key);
      if (!thumbOk && Number(row.thumb_size_bytes) > 0) {
        released += Number(row.thumb_size_bytes);
      }

      await admin
        .from("media")
        .update({
          status: "ready",
          width: item.width ?? null,
          height: item.height ?? null,
          thumb_key: thumbOk ? row.thumb_key : null,
          thumb_size_bytes: thumbOk ? row.thumb_size_bytes : 0,
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
