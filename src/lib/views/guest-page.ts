import "server-only";

import { type Appearance, resolveAppearance } from "@/lib/appearance";
import { findReadyMedia } from "@/lib/db/media-repo";
import type { EventRow } from "@/lib/db/types";
import { storageSummary } from "@/lib/events";
import { gateGuest, resolveGuestToken } from "@/lib/guards/guest";
import { toMediaView } from "@/lib/media/view";
import { createAdminClient } from "@/lib/supabase/admin";
import { type Tier, getTier } from "@/lib/tiers";

/**
 * What a guest sees when they scan the code, or why they see nothing.
 *
 * The two refusals are separate states rather than one: a link that never
 * worked and an event that has finished are different things to be told, and
 * the page says so.
 */
export type GuestPage =
  | { state: "unknown" }
  | { state: "closed"; eventName: string }
  | {
      state: "open";
      event: EventRow;
      tier: Tier;
      appearance: Appearance;
      remainingBytes: number;
      coverUrl: string | null;
      /**
       * Whether the cover about to render is the screen-filling one. It has to
       * match what EventCover decides rather than what the row says: a "full
       * screen" cover with no photo falls back to "just type", and stretching
       * that short header down a whole screen is a page with a hole in it.
       */
      fullScreenCover: boolean;
    };

export async function loadGuestPage(token: string): Promise<GuestPage> {
  const ctx = await resolveGuestToken(token);
  if (!ctx) return { state: "unknown" };

  if (gateGuest(ctx.event).state !== "open") {
    return { state: "closed", eventName: ctx.event.name };
  }

  const event = ctx.event;
  // The gate is here, not in the form that wrote these columns: a free event
  // renders as a free event whatever its row happens to contain.
  const appearance = resolveAppearance(event);

  let coverUrl: string | null = null;
  if (event.cover_media_id && appearance.cover !== "type") {
    const row = await findReadyMedia(createAdminClient(), event.cover_media_id);
    if (row) {
      const view = await toMediaView(row);
      // The full copy, not `previewUrl`. That one is the 640px thumbnail the
      // gallery grid loads fifty of, and the cover is the opposite case: one
      // photograph across a whole phone, where 640px is visibly soft. The
      // thumbnail is only the fallback, for a row with no full copy - one
      // still waiting on the worker, or written before the folders existed.
      coverUrl = view.fullUrl ?? view.previewUrl;
    }
  }

  return {
    state: "open",
    event,
    tier: getTier(event.tier),
    appearance,
    remainingBytes: storageSummary(event).remaining,
    coverUrl,
    fullScreenCover: appearance.cover === "full" && coverUrl !== null,
  };
}
