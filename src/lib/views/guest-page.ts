import "server-only";

import { type Appearance, resolveAppearance } from "@/lib/appearance";
import type { EventRow } from "@/lib/db/types";
import { storageSummary } from "@/lib/events";
import { gateGuest, resolveGuestToken } from "@/lib/guards/guest";
import { type Tier, getTier } from "@/lib/tiers";
import { loadCoverUrls } from "@/lib/views/cover";

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
      /** See CoverUrls - the thumbnail the full copy fades in over. */
      coverPreviewUrl: string | null;
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

  const { coverUrl, coverPreviewUrl } = await loadCoverUrls(event, appearance);

  return {
    state: "open",
    event,
    tier: getTier(event.tier),
    appearance,
    remainingBytes: storageSummary(event).remaining,
    coverUrl,
    coverPreviewUrl,
    fullScreenCover: appearance.cover === "full" && coverUrl !== null,
  };
}
