import { ApiError, handle, ok } from "@/lib/api";
import { findEventMedia } from "@/lib/db/media-repo";
import { requireVisibleGallery } from "@/lib/guards/guest";
import { toMediaView } from "@/lib/media/view";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The stored object, one at a time, behind a short-lived signature.
 *
 * A gallery page never calls this - it resolves only when somebody opens a
 * photo to download it or plays a video, which keeps the signing work and the
 * expensive bytes off the common path.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    const id = url.searchParams.get("id") ?? "";

    const ctx = await requireVisibleGallery(token);

    const row = await findEventMedia(createAdminClient(), {
      id,
      eventId: ctx.event.id,
    });
    if (!row) throw new ApiError("not_found", "That photo is not here.");

    return ok(await toMediaView(row, { withUrl: true }));
  });
}
