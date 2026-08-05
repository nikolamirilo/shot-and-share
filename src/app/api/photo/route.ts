import { ApiError, handle, ok } from "@/lib/api";
import { resolveGuestToken, gateGuest, toMediaView } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Full-resolution originals, one at a time, behind a short-lived signature.
 *
 * Thumbnails are cacheable and public; originals are not. A gallery page never
 * calls this - it resolves only when somebody actually opens a photo, which
 * keeps the expensive bytes off the common path.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    const id = url.searchParams.get("id") ?? "";

    const ctx = await resolveGuestToken(token);
    if (!ctx) throw new ApiError("not_found", "This link is not valid any more.");
    if (gateGuest(ctx.event).state !== "open") {
      throw new ApiError("gone", "This event has closed.");
    }
    if (!ctx.event.gallery_visible) {
      throw new ApiError("forbidden", "The host has kept this gallery private.");
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("media")
      .select("*")
      .eq("id", id)
      .eq("event_id", ctx.event.id)
      .eq("status", "ready")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new ApiError("not_found", "That photo is not here.");

    return ok(await toMediaView(row, { withOriginal: true }));
  });
}
