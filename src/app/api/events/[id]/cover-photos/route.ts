import { handle, ok } from "@/lib/api";
import type { MediaRow } from "@/lib/db/types";
import { toMediaViews } from "@/lib/events";
import { requireOwnedEvent } from "@/lib/host";
import { COVER_PAGE_SIZE } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A page of the event's photographs, for the cover picker.
 *
 * The picker used to show whatever the console had already loaded, cut to the
 * first two dozen: a host whose cover shot was taken on the second night could
 * not reach it at all. This pages through the lot, newest first, on the same
 * keyset cursor the guest gallery uses - `created_at` rather than an offset, so
 * a photo arriving mid-browse cannot shuffle a row the host is looking at.
 *
 * Guest photographs only. The host's own uploaded covers come down with the
 * page itself: there are only ever a handful, and they belong in their own row
 * rather than scattered through the event by date.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const event = await requireOwnedEvent(id);

    const before = new URL(request.url).searchParams.get("before");
    const supabase = await createClient();

    let query = supabase
      .from("media")
      .select("*")
      .eq("event_id", event.id)
      .eq("status", "ready")
      .eq("source", "guest")
      .order("created_at", { ascending: false })
      .limit(COVER_PAGE_SIZE);

    if (before) query = query.lt("created_at", before);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as MediaRow[];
    return ok({
      items: await toMediaViews(rows),
      nextCursor:
        rows.length === COVER_PAGE_SIZE
          ? rows[rows.length - 1].created_at
          : null,
    });
  });
}
