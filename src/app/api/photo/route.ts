import { ApiError, handle, ok } from "@/lib/api";
import { findEventMedia } from "@/lib/db/media-repo";
import { requireVisibleGallery } from "@/lib/guards/guest";
import { toMediaView } from "@/lib/media/view";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
