import "server-only";

import { type Appearance, resolveAppearance } from "@/lib/appearance";
import { type EventRow } from "@/types/db";
import { storageSummary } from "@/lib/events";
import { gateGuest, resolveGuestToken } from "@/lib/guards/guest";
import { type Tier, getTier } from "@/lib/tiers";
import { loadCoverUrls } from "@/lib/views/cover";

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
      coverPreviewUrl: string | null;
      fullScreenCover: boolean;
    };

export async function loadGuestPage(token: string): Promise<GuestPage> {
  const ctx = await resolveGuestToken(token);
  if (!ctx) return { state: "unknown" };

  if (gateGuest(ctx.event).state !== "open") {
    return { state: "closed", eventName: ctx.event.name };
  }

  const event = ctx.event;
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
