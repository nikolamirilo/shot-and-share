import "server-only";

import { ApiError } from "@/lib/api";
import type { EventRow } from "@/lib/db/types";
import {
  type GuestContext,
  resolveGuestToken,
} from "@/lib/guards/guest-token";

/**
 * What a guest holding a share link is allowed to do.
 *
 * Three questions, three guards. They were spelled out inline at each route and
 * had already drifted: the gallery and the photo endpoint checked whether the
 * host had hidden the gallery, the upload guard did not.
 */

export type GuestGate =
  | { state: "open"; event: EventRow }
  | { state: "expired"; event: EventRow }
  | { state: "closed"; event: EventRow };

export function gateGuest(event: EventRow): GuestGate {
  if (event.status !== "active") return { state: "expired", event };
  if (event.expires_at && new Date(event.expires_at) < new Date()) {
    return { state: "expired", event };
  }
  return { state: "open", event };
}

/**
 * The link works and the event is still open. `closed` is the caller's wording
 * because the two sides of the product are refusing different things: one guest
 * is trying to add a photograph, the other to look at one.
 */
async function requireOpenEvent(
  token: string,
  closed: string,
): Promise<GuestContext> {
  const ctx = await resolveGuestToken(token);
  if (!ctx) {
    throw new ApiError("not_found", "This link is not valid any more.");
  }
  if (gateGuest(ctx.event).state !== "open") {
    throw new ApiError("gone", closed);
  }
  return ctx;
}

/** Enough to add a photograph. */
export function requireGuestEvent(token: string): Promise<GuestContext> {
  return requireOpenEvent(
    token,
    "This event has closed and is no longer accepting photos.",
  );
}

/**
 * Enough to look at one: the above, plus the host not having hidden the
 * gallery. Adding a photograph does not need that, which is why these are two
 * guards rather than one with a flag.
 */
export async function requireVisibleGallery(
  token: string,
): Promise<GuestContext> {
  const ctx = await requireOpenEvent(token, "This event has closed.");
  if (!ctx.event.gallery_visible) {
    throw new ApiError("forbidden", "The host has kept this gallery private.");
  }
  return ctx;
}

export { resolveGuestToken, type GuestContext };
