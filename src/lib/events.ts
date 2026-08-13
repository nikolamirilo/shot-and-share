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
