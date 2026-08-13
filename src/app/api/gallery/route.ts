import { ApiError, handle, ok } from "@/lib/api";
import { enforceRateLimit } from "@/lib/guards";
import {
  GALLERY_PAGE_SIZE,
  resolveGuestToken,
  gateGuest,
  toMediaViews,
} from "@/lib/events";
import { LIMITS, clientIp } from "@/lib/ratelimit";
import { listGuestPage } from "@/lib/db/media-repo";
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

    enforceRateLimit(
      LIMITS.guestPage,
      `gallery:${clientIp(request.headers)}`,
      "Slow down a moment.",
    );

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

    // The admin client: a guest has no session, so the token check above is
    // what stands in for one.
    const { rows, nextCursor } = await listGuestPage(createAdminClient(), {
      eventId: ctx.event.id,
      before,
      pageSize: GALLERY_PAGE_SIZE,
    });

    /*
     * `force-dynamic` above stops Next from caching the work; this stops
     * everything between here and the phone from caching the answer. The
     * gallery is re-requested precisely when it has changed - a guest has just
     * uploaded - so a CDN or a browser handing back the copy from thirty
     * seconds ago is indistinguishable from the upload having failed.
     */
    return ok(
      { items: await toMediaViews(rows), nextCursor },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  });
}
