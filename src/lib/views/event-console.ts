import "server-only";

import { findEvent } from "@/lib/db/event-repo";
import { listCoverMedia, listGuestMedia } from "@/lib/db/media-repo";
import type { EventRow } from "@/lib/db/types";
import { env } from "@/lib/env";
import { getActiveShareToken, storageSummary } from "@/lib/events";
import type { MediaView } from "@/lib/media-view";
import { toMediaViews } from "@/lib/media/view";
import { createClient } from "@/lib/supabase/server";
import { type Tier, getTier } from "@/lib/tiers";
import { shareUrl } from "@/lib/tokens";

/**
 * Everything the host's console needs, in one object.
 *
 * The page was doing five queries, mapping rows to views, resolving the tier
 * and building the share URL before it got to any markup. None of that is
 * layout, and none of it was testable without rendering React.
 */

/** How many photographs the console loads. The gallery pages for the rest. */
const GALLERY_SEED = 120;

export interface EventConsole {
  event: EventRow;
  tier: Tier;
  summary: ReturnType<typeof storageSummary>;
  media: MediaView[];
  covers: MediaView[];
  /** Every guest photograph at the event, not only the loaded ones. */
  photoCount: number;
  uploaderCount: number;
  /** Null when the host has revoked every link. */
  shareLink: string | null;
}

export async function loadEventConsole(
  id: string,
): Promise<EventConsole | null> {
  const supabase = await createClient();

  const event = await findEvent(supabase, id);
  if (!event) return null;

  const [{ data: stats }, mediaRows, coverRows, active] = await Promise.all([
    supabase.rpc("event_stats", { p_event: event.id }),
    listGuestMedia(supabase, event.id, GALLERY_SEED),
    // All of them: there are only ever a handful, and they get their own row at
    // the top of the picker so a host can go back to one from last week.
    listCoverMedia(supabase, event.id),
    getActiveShareToken(event.id),
  ]);

  const counts = stats?.[0] ?? {
    photo_count: 0,
    video_count: 0,
    uploader_count: 0,
    bytes: 0,
  };

  return {
    event,
    tier: getTier(event.tier),
    summary: storageSummary(event),
    media: await toMediaViews(mediaRows),
    covers: await toMediaViews(coverRows),
    photoCount: Number(counts.photo_count) + Number(counts.video_count),
    uploaderCount: Number(counts.uploader_count),
    shareLink: active ? shareUrl(env.siteUrl, active.token) : null,
  };
}
