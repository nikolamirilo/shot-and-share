import { handle, ok } from "@/lib/api";
import { countGuestMedia, listGuestPage } from "@/lib/db/media-repo";
import { enforceRateLimit } from "@/lib/guards";
import { requireVisibleGallery } from "@/lib/guards/guest";
import { GALLERY_PAGE_SIZE } from "@/lib/media-view";
import { toMediaViews } from "@/lib/media/view";
import { LIMITS, clientIp } from "@/lib/ratelimit";
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

    const ctx = await requireVisibleGallery(token);

    // The admin client: a guest has no session, so the token check above is
    // what stands in for one.
    const admin = createAdminClient();

    // Alongside the page, not after it: the count is an index-only scan and
    // waiting for one to start the other would put the slower of the two on
    // top of the faster for nothing.
    const [{ rows, nextCursor }, total] = await Promise.all([
      listGuestPage(admin, {
        eventId: ctx.event.id,
        before,
        pageSize: GALLERY_PAGE_SIZE,
      }),
      countGuestMedia(admin, ctx.event.id),
    ]);

    /*
     * `force-dynamic` stops Next caching the work; this stops everything
     * between here and the phone caching the answer. The gallery is
     * re-requested precisely when it has changed - a guest has just uploaded -
     * so a stale copy is indistinguishable from a failed upload.
     */
    return ok(
      { items: await toMediaViews(rows), nextCursor, total },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  });
}
