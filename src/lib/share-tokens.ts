import "server-only";

import { encryptToken } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateToken, hashToken } from "@/lib/tokens";

/** Creates a fresh share link. Used at creation and when a host rotates one. */
export async function issueTokenFor(eventId: string, label = "Primary link") {
  const admin = createAdminClient();
  const token = generateToken();
  const { error } = await admin.from("event_tokens").insert({
    event_id: eventId,
    token_hash: hashToken(token),
    token_cipher: encryptToken(token),
    label,
    revoked: false,
  });
  if (error) throw new Error(error.message);
  return token;
}
