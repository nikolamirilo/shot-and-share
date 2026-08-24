import { handle, ok } from "@/lib/api";
import { listGuestMediaSince, listGuestPage } from "@/lib/db/media-repo";
import { toMediaViews } from "@/lib/events";
import { requireOwnedEvent } from "@/lib/host";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One poll's worth. The slideshow asks again as soon as Realtime nudges it. */
const BATCH = 60;

/**
 * A backfill page. Bigger than a poll because it is a burst at the start rather
 * than a heartbeat: a wedding with three thousand photographs is fifteen
 * requests this way and fifty at the poll's size.
 */
const PAGE = 200;

/**
 * This event's guest photographs, with usable URLs attached, in the two
 * directions the slideshow reads them.
 *
 * `since` is the live tail: Realtime tells the wall *that* a photo landed, this
 * tells it *where*. `before` walks the other way, back through everything that
 * arrived before the page was opened, so the show is the whole evening rather
 * than the last hour of it.
 *
 * Resolving the URL here rather than in the browser keeps the signing key
 * server-side and means the slideshow works the same whether media is on S3
 * behind a CDN or on the local disk in development.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    const since = query.get("since");
    const before = query.get("before");

    // Ownership, not just a session: querying by the id in the URL after only
    // an is-signed-in check would leave RLS as the sole thing between one host
    // and another's event.
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
    // Only the backfill pages; the tail is whatever has arrived since.
    return ok({ items: await toMediaViews(rows), nextCursor: null });
  });
}
