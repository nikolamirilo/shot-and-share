import { handle, ok } from "@/lib/api";
import { toMediaViews } from "@/lib/events";
import { requireOwnedEvent } from "@/lib/host";
import { COVER_PAGE_SIZE } from "@/lib/media";
import { listGuestPage } from "@/lib/db/media-repo";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A page of the event's photographs, for the cover picker. Keyset on
 * `created_at` rather than an offset, so a photo arriving mid-browse cannot
 * shuffle a row the host is looking at.
 *
 * Guest photographs only: the host's own covers come down with the page itself
 * and get their own row rather than being scattered through the event by date.
 */
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
