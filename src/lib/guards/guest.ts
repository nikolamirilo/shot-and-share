import "server-only";

import { ApiError } from "@/lib/api";
import { type EventRow } from "@/types/db";
import {
  type GuestContext,
  resolveGuestToken,
} from "@/lib/guards/guest-token";

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

export function requireGuestEvent(token: string): Promise<GuestContext> {
  return requireOpenEvent(
    token,
    "This event has closed and is no longer accepting photos.",
  );
}

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
