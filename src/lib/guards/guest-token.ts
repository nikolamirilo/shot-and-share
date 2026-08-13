import "server-only";

import type { EventRow } from "@/lib/db/types";
import { hasSupabase } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, looksLikeToken } from "@/lib/tokens";

/**
 * Share token to event. The whole guest authorisation model: a high-entropy
 * token, hashed at rest, that maps to exactly one event. There is no guest
 * session and there is not going to be one.
 *
 * Its own module so that the guards above it are the only thing left to test:
 * the database lookup is the seam, and the gate and visibility rules sit on
 * the other side of it.
 */

export interface GuestContext {
  event: EventRow;
  tokenId: string;
}

export async function resolveGuestToken(
  token: string,
): Promise<GuestContext | null> {
  if (!looksLikeToken(token)) return null;

  // A guest standing in a venue must never see a stack trace. If the backend is
  // misconfigured they get the same "this link is not working" page as a
  // revoked token, and the operator gets the noise in the logs.
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
