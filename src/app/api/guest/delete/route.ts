import { z } from "zod";

import { ApiError, handle, ok, parseBody } from "@/lib/api";
import { requireGuestEvent } from "@/lib/events";
import { mediaBytes, mediaKeys } from "@/lib/media";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A guest removing something they just uploaded by mistake.
 *
 * There are no guest accounts, so ownership is the random fingerprint the
 * browser keeps in localStorage plus a short time window. That is weak proof
 * and it is the right amount of proof: the worst case is someone who cleared
 * their storage cannot undo their own blurry photo, and the host can always
 * delete anything. Widening it would mean guest accounts, which is the one
 * thing this product refuses to add.
 */
const WINDOW_MINUTES = 60;

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  fingerprint: z.string().min(8).max(64),
  mediaId: z.string().uuid(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    const { event } = await requireGuestEvent(body.token);
    const admin = createAdminClient();

    const { data: row, error } = await admin
      .from("media")
      .select("*")
      .eq("id", body.mediaId)
      .eq("event_id", event.id)
      .eq("uploader_fingerprint", body.fingerprint)
      .neq("status", "deleted")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) {
      throw new ApiError("not_found", "That photo is not yours to remove.");
    }

    const ageMinutes = (Date.now() - new Date(row.created_at).getTime()) / 60_000;
    if (ageMinutes > WINDOW_MINUTES) {
      throw new ApiError(
        "forbidden",
        "That was uploaded a while ago. Ask the host to remove it.",
      );
    }

    await storage.remove(mediaKeys(row));
    await admin.from("media").update({ status: "deleted" }).eq("id", row.id);
    await admin.rpc("release_storage", {
      p_event: event.id,
      p_bytes: mediaBytes(row),
    });

    return ok({ deleted: true });
  });
}
