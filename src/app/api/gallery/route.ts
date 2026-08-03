import { ApiError, fail, handle, ok } from "@/lib/api";
import {
  GALLERY_PAGE_SIZE,
  resolveGuestToken,
  gateGuest,
  toMediaViews,
} from "@/lib/events";
import { LIMITS, clientIp, rateLimit } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The gallery reads from Postgres and renders CDN URLs. It never calls
 * ListObjects: LIST is billed at the expensive request rate and this endpoint
 * runs on every scroll, for every guest.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    const before = url.searchParams.get("before");

    const limit = rateLimit(
      `gallery:${clientIp(request.headers)}`,
      LIMITS.guestPage.limit,
      LIMITS.guestPage.window,
    );
    if (!limit.ok) {
      return fail("rate_limited", "Slow down a moment.", {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const ctx = await resolveGuestToken(token);
    if (!ctx) throw new ApiError("not_found", "This link is not valid any more.");

    const gate = gateGuest(ctx.event);
    if (gate.state !== "open") {
      throw new ApiError("gone", "This event has closed.");
    }
    if (!ctx.event.gallery_visible) {
      throw new ApiError(
        "forbidden",
        "The host has kept this gallery private.",
      );
    }

    const admin = createAdminClient();
    let query = admin
      .from("media")
      .select("*")
      .eq("event_id", ctx.event.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(GALLERY_PAGE_SIZE);

    if (before) query = query.lt("created_at", before);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    return ok({
      items: await toMediaViews(rows),
      nextCursor:
        rows.length === GALLERY_PAGE_SIZE
          ? rows[rows.length - 1].created_at
          : null,
    });
  });
}
