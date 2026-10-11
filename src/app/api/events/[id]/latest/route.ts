import { handle, ok } from "@/lib/api";
import { listGuestMediaSince, listGuestPage } from "@/lib/db/media-repo";
import { toMediaViews } from "@/lib/media/view";
import { requireOwnedEvent } from "@/lib/guards/host-api";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 60;

const PAGE = 200;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    const since = query.get("since");
    const before = query.get("before");

    const event = await requireOwnedEvent(id);
    const supabase = await createClient();

    if (before) {
      const { rows, nextCursor } = await listGuestPage(supabase, {
        eventId: event.id,
        before,
        pageSize: PAGE,
      });
      return ok({ items: await toMediaViews(rows), nextCursor });
    }

    const rows = await listGuestMediaSince(supabase, event.id, since, BATCH);
    return ok({ items: await toMediaViews(rows), nextCursor: null });
  });
}
