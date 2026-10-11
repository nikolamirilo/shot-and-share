import { ApiError, handle, ok } from "@/lib/api";
import {
  countVisibleGuestMedia,
  listGuestPage,
  listVisibleGuestMediaByIds,
} from "@/lib/db/media-repo";
import { enforceRateLimit } from "@/lib/guards/rate-limit";
import { requireVisibleGallery } from "@/lib/guards/guest";
import { GALLERY_PAGE_SIZE } from "@/constants/gallery";
import { coerceSort } from "@/utils/media-view";
import { toMediaViews } from "@/lib/media/view";
import { LIMITS } from "@/constants/limits";
import { clientIp } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Never calls ListObjects: LIST is billed at the expensive request rate. */
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

    const admin = createAdminClient();

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
