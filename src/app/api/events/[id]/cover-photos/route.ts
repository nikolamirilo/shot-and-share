import { handle, ok } from "@/lib/api";
import { toMediaViews } from "@/lib/media/view";
import { requireOwnedEvent } from "@/lib/guards/host-api";
import { COVER_PAGE_SIZE } from "@/lib/media";
import { listGuestPage } from "@/lib/db/media-repo";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const event = await requireOwnedEvent(id);

    const before = new URL(request.url).searchParams.get("before");

    const { rows, nextCursor } = await listGuestPage(await createClient(), {
      eventId: event.id,
      before,
      pageSize: COVER_PAGE_SIZE,
    });

    return ok({ items: await toMediaViews(rows), nextCursor });
  });
}
