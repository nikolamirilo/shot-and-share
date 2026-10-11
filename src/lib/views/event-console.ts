import "server-only";

import { type Appearance, resolveAppearance } from "@/lib/appearance";
import { findEvent } from "@/lib/db/event-repo";
import {
  listCoverMedia,
  listGuestMedia,
  listMediaAwaitingReview,
} from "@/lib/db/media-repo";
import { type EventRow } from "@/types/db";
import { env } from "@/lib/env";
import { getActiveShareToken, storageSummary } from "@/lib/events";
import { type MediaView } from "@/types/media";
import { toMediaViews } from "@/lib/media/view";
import { countKeepingYears } from "@/lib/payments/grant";
import { createClient } from "@/lib/supabase/server";
import { type Tier, getTier } from "@/lib/tiers";
import { shareUrl } from "@/lib/tokens";
import { type CoverUrls, loadCoverUrls } from "@/lib/views/cover";

const GALLERY_SEED = 120;

export interface EventConsole extends CoverUrls {
  event: EventRow;
  tier: Tier;
  appearance: Appearance;
  summary: ReturnType<typeof storageSummary>;
  media: MediaView[];
  covers: MediaView[];
  review: MediaView[];
  photoCount: number;
  photos: number;
  videos: number;
  uploaderCount: number;
  keptYears: number;
  shareLink: string | null;
}

export async function loadEventConsole(
  id: string,
): Promise<EventConsole | null> {
  const supabase = await createClient();

  const event = await findEvent(supabase, id);
  if (!event) return null;

  const appearance = resolveAppearance(event);

  const [
    { data: stats },
    mediaRows,
    coverRows,
    reviewRows,
    active,
    keptYears,
    cover,
  ] = await Promise.all([
    supabase.rpc("event_stats", { p_event: event.id }),
    listGuestMedia(supabase, event.id, GALLERY_SEED),
    listCoverMedia(supabase, event.id),
    listMediaAwaitingReview(supabase, event.id),
    getActiveShareToken(event.id),
    countKeepingYears(event.id),
    loadCoverUrls(event, appearance),
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
    appearance,
    summary: storageSummary(event),
    media: await toMediaViews(mediaRows),
    covers: await toMediaViews(coverRows),
    review: await toMediaViews(reviewRows),
    photoCount: Number(counts.photo_count) + Number(counts.video_count),
    photos: Number(counts.photo_count),
    videos: Number(counts.video_count),
    uploaderCount: Number(counts.uploader_count),
    keptYears,
    shareLink: active ? shareUrl(env.siteUrl, active.token) : null,
    ...cover,
  };
}
