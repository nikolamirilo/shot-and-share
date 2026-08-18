import "server-only";

import { decryptToken } from "@/lib/crypto";
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
 * The live share link for an event, decrypted so the dashboard can render the
 * QR code. Null when the host has revoked every link - which is the point of
 * revoking, so callers must handle it rather than reissue silently.
 */
export async function getActiveShareToken(
  eventId: string,
): Promise<{ token: string; tokenId: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("event_tokens")
    .select("id, token_cipher")
    .eq("event_id", eventId)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.token_cipher) return null;
  const token = decryptToken(data.token_cipher);
  return token ? { token, tokenId: data.id } : null;
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
    const token = row.token_cipher ? decryptToken(row.token_cipher) : null;
    if (token) tokens.set(row.event_id, token);
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
