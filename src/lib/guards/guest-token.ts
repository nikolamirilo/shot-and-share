import "server-only";

import { type EventRow } from "@/types/db";
import { hasSupabase } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, looksLikeToken } from "@/lib/tokens";

export interface GuestContext {
  event: EventRow;
  tokenId: string;
}

export async function resolveGuestToken(
  token: string,
): Promise<GuestContext | null> {
  if (!looksLikeToken(token)) return null;

  if (!hasSupabase) {
    console.error("[guest] Supabase is not configured; refusing every link.");
    return null;
  }

  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("event_tokens")
    .select("id, event_id, revoked")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!tokenRow || tokenRow.revoked) return null;

  const { data: event } = await admin
    .from("events")
    .select("*")
    .eq("id", tokenRow.event_id)
    .maybeSingle();

  if (!event) return null;
  return { event: event as EventRow, tokenId: tokenRow.id };
}
