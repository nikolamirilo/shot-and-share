import { ApiError, handle, ok } from "@/lib/api";
import type { MediaRow } from "@/lib/db/types";
import { toMediaViews } from "@/lib/events";
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

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError("unauthorized", "Sign in first.");

    let query = supabase
      .from("media")
      .select("*")
      .eq("event_id", id)
      .eq("status", "ready")
      // The slideshow is the party looking at itself. A cover the host uploaded
      // is not part of that - see migration 0013.
      .eq("source", "guest")
      .order("created_at", { ascending: false })
      .limit(60);

    if (since) query = query.gt("created_at", since);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ok({ items: await toMediaViews((data ?? []) as MediaRow[]) });
  });
}
