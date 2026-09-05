import "server-only";

import { encryptToken, readToken } from "@/lib/crypto";
import type { EventRow } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTier } from "@/lib/tiers";

export function storageSummary(event: EventRow) {
  const tier = getTier(event.tier);
  const used = Number(event.storage_used_bytes);
  const quota = Number(event.storage_quota_bytes);
  return {
    tier,
    used,
    quota,
    remaining: Math.max(0, quota - used),
    percent: quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0,
    full: used >= quota,
  };
}

/**
 * The live share link for an event, and why there is not one when there is not.
 *
 * Three answers rather than two. "Revoked" and "we cannot read what is stored"
 * look identical from a null, and they call for opposite things: the first
 * wants a new link, the second must not have one, because the stored link is
 * still live on every printed card - it is only the key that changed.
 */
export type ShareLinkState =
  | { state: "active"; token: string; tokenId: string }
  | { state: "unreadable"; tokenId: string }
  | { state: "none" };

export async function getShareLinkState(
  eventId: string,
): Promise<ShareLinkState> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("event_tokens")
    .select("id, token_cipher")
    .eq("event_id", eventId)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.token_cipher) return { state: "none" };

  const read = readToken(data.token_cipher);
  if (!read) return { state: "unreadable", tokenId: data.id };

  // Read under a key we have stopped writing with. Store it again so the next
  // read is a single decrypt, and so the old key can eventually be dropped.
  if (read.stale) {
    await admin
      .from("event_tokens")
      .update({ token_cipher: encryptToken(read.token) })
      .eq("id", data.id);
  }

  return { state: "active", token: read.token, tokenId: data.id };
}

/**
 * The same, for callers that only have something to do with a link they can
 * read. Null when the host has revoked every link - which is the point of
 * revoking, so callers must handle it rather than reissue silently.
 */
export async function getActiveShareToken(
  eventId: string,
): Promise<{ token: string; tokenId: string } | null> {
  const active = await getShareLinkState(eventId);
  return active.state === "active"
    ? { token: active.token, tokenId: active.tokenId }
    : null;
}

/**
 * The same answer for a list of events, in one query rather than one per card.
 * An event with no live link is simply absent from the map, which is the same
 * thing the singular version says with null.
 */
export async function getActiveShareTokens(
  eventIds: string[],
): Promise<Map<string, string>> {
  if (eventIds.length === 0) return new Map();

  const admin = createAdminClient();
  const { data } = await admin
    .from("event_tokens")
    .select("event_id, token_cipher, created_at")
    .in("event_id", eventIds)
    .eq("revoked", false)
    .order("created_at", { ascending: false });

  const tokens = new Map<string, string>();
  const seen = new Set<string>();
  for (const row of data ?? []) {
    // Newest first, so the first row for an event is its current link. An
    // event is marked seen whether or not that row decrypts, or a cipher we
    // cannot read would quietly hand back a link the host has replaced.
    if (seen.has(row.event_id)) continue;
    seen.add(row.event_id);
    // Not re-encrypted the way the singular version does: this is the list
    // page, and a stale key heals when the host opens the event.
    const read = row.token_cipher ? readToken(row.token_cipher) : null;
    if (read) tokens.set(row.event_id, read.token);
  }
  return tokens;
}

/**
 * Re-exported so `@/lib/events` keeps meaning what it meant. New code should
 * import from the module that owns each of these.
 */
export {
  gateGuest,
  requireGuestEvent,
  requireVisibleGallery,
  resolveGuestToken,
  type GuestContext,
  type GuestGate,
} from "@/lib/guards/guest";
export { toMediaView, toMediaViews } from "@/lib/media/view";
export { GALLERY_PAGE_SIZE, type MediaView } from "@/lib/media-view";
