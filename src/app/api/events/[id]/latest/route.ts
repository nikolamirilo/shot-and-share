import { handle, ok } from "@/lib/api";
import type { MediaRow } from "@/lib/db/types";
import { toMediaViews } from "@/lib/events";
import { guestMedia } from "@/lib/db/media-repo";
import { requireOwnedEvent } from "@/lib/host";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // Ownership, not just a session. This route used to check only that
    // somebody was signed in and then query by the id in the URL, which left
    // RLS as the sole thing standing between one host and another host's
    // event - and made it the only route under events/[id] where that was so.
    const event = await requireOwnedEvent(id);
    const supabase = await createClient();

    // The slideshow is the party looking at itself, so a cover the host
    // uploaded is not part of it - see migration 0013.
    let query = guestMedia(supabase, event.id).limit(60);

    if (since) query = query.gt("created_at", since);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ok({ items: await toMediaViews((data ?? []) as MediaRow[]) });
  });
}
