import { ApiError, handle, ok } from "@/lib/api";
import {
  countVisibleGuestMedia,
  listGuestPage,
  listVisibleGuestMediaByIds,
} from "@/lib/db/media-repo";
import { enforceRateLimit } from "@/lib/guards";
import { requireVisibleGallery } from "@/lib/guards/guest";
import { GALLERY_PAGE_SIZE, coerceSort } from "@/lib/media-view";
import { toMediaViews } from "@/lib/media/view";
import { LIMITS, clientIp } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Favourites asked for in one request. The wall asks again for the rest. */
const MAX_IDS = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const kindParam = url.searchParams.get("kind");
    const kind =
      kindParam === "photo" || kindParam === "video" ? kindParam : null;
    const sort = coerceSort(url.searchParams.get("sort"));
    const idsParam = url.searchParams.get("ids");

    enforceRateLimit(
      LIMITS.guestPage,
      `gallery:${clientIp(request.headers)}`,
      "Slow down a moment.",
    );

    const ctx = await requireVisibleGallery(token);

    // The admin client: a guest has no session, so the token check above is
    // what stands in for one.
    const admin = createAdminClient();

    /*
     * A guest's favourites, by id. They live on the guest's phone and can be
     * from any point in the evening, so they cannot be found by paging. Only
     * ids that are still visible come back - a favourite the host has since
     * deleted or held just drops out.
     */
    if (idsParam !== null) {
      const ids = idsParam.split(",").filter((id) => UUID.test(id));
      if (ids.length > MAX_IDS) {
        throw new ApiError(
          "bad_request",
          `Ask for at most ${MAX_IDS} at a time.`,
        );
      }
      const rows = await listVisibleGuestMediaByIds(admin, ctx.event.id, ids);
      return ok(
        { items: await toMediaViews(rows), nextCursor: null },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    // Alongside the page, not after it: waiting for one to start the others
    // would put the slower on top of the faster for nothing.
    const [{ rows, nextCursor }, photos, videos] = await Promise.all([
      listGuestPage(admin, {
        eventId: ctx.event.id,
        before,
        pageSize: GALLERY_PAGE_SIZE,
        kind,
        sort,
      }),
      countVisibleGuestMedia(admin, ctx.event.id, "photo"),
      countVisibleGuestMedia(admin, ctx.event.id, "video"),
    ]);

    const total =
      kind === "photo"
        ? photos
        : kind === "video"
          ? videos
          : photos === null || videos === null
            ? null
            : photos + videos;

    /*
     * `force-dynamic` stops Next caching the work; this stops everything
     * between here and the phone caching the answer. The gallery is
     * re-requested precisely when it has changed - a guest has just uploaded -
     * so a stale copy is indistinguishable from a failed upload.
     */
    return ok(
      {
        items: await toMediaViews(rows),
        nextCursor,
        total,
        counts: { photo: photos, video: videos },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  });
}
