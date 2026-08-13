import { handle, ok } from "@/lib/api";
import { listGuestMediaSince } from "@/lib/db/media-repo";
import { toMediaViews } from "@/lib/events";
import { requireOwnedEvent } from "@/lib/host";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One poll's worth. The slideshow asks again as soon as Realtime nudges it. */
const BATCH = 60;

/**
 * Media that arrived after a given timestamp, with usable URLs attached.
 *
 * The slideshow's Realtime subscription tells it *that* a photo landed; this
 * tells it *where*. Resolving the URL here rather than in the browser keeps the
 * signing key server-side and means the slideshow works the same whether media
 * is on S3 behind a CDN or on the local disk in development.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const since = new URL(request.url).searchParams.get("since");

    // Ownership, not just a session: querying by the id in the URL after only
    // an is-signed-in check would leave RLS as the sole thing between one host
    // and another's event.
    const event = await requireOwnedEvent(id);
    const supabase = await createClient();

    const rows = await listGuestMediaSince(supabase, event.id, since, BATCH);
    return ok({ items: await toMediaViews(rows) });
  });
}
