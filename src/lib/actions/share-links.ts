"use server";

import { revalidatePath } from "next/cache";

import { requireOwnedEvent } from "@/lib/actions/guards";
import type { ActionState } from "@/lib/actions/types";
import { encryptToken } from "@/lib/crypto";
import { issueTokenFor } from "@/lib/share-tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, looksLikeToken } from "@/lib/tokens";

/**
 * Both of these close the current link. Rotating mints a replacement in the
 * same breath; revoking does not.
 */
async function revokeAll(eventId: string) {
  const { error } = await createAdminClient()
    .from("event_tokens")
    .update({ revoked: true })
    .eq("event_id", eventId)
    .eq("revoked", false);
  return error?.message ?? null;
}

/**
 * Revoke and reissue. This is how a host shuts down an event that is attracting
 * junk: the old link stops working immediately, and a new one is minted so the
 * people who should still have access can be sent it.
 */
export async function rotateShareLink(eventId: string): Promise<ActionState> {
  await requireOwnedEvent(eventId);

  const failure = await revokeAll(eventId);
  if (failure) return { error: failure };

  await issueTokenFor(eventId, "Reissued link");
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/** Closes the event to new uploads without minting a replacement. */
export async function revokeShareLink(eventId: string): Promise<ActionState> {
  await requireOwnedEvent(eventId);

  const failure = await revokeAll(eventId);
  if (failure) return { error: failure };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/**
 * Takes a link the host still has and makes the dashboard able to show it
 * again.
 *
 * For the one case the rest of this file cannot help with: the token is stored
 * encrypted, the key changed, and what is in the database can no longer be
 * read. The link itself never stopped working - guests are matched on a hash,
 * which has no key in it - so reissuing here would break every printed card to
 * fix a display problem. Handing back the link instead costs nothing: the hash
 * proves it is this event's, and it is written again under the current key.
 */
export async function restoreShareLink(
  eventId: string,
  value: string,
): Promise<ActionState> {
  await requireOwnedEvent(eventId);

  const token = tokenIn(value);
  if (!token) {
    return {
      error:
        "That does not look like one of our links. Paste the whole address, or scan a printed code and paste what it opens.",
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_tokens")
    .select("id")
    .eq("event_id", eventId)
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) {
    return { error: "That link was not issued for this event." };
  }

  /*
   * Un-revoked as well as re-encrypted, because a host reaching for this has a
   * link in their hand and expects it to work. Nothing else is touched: another
   * live link is another working printed card, and the newest live one is the
   * one the dashboard shows.
   */
  const { error: failure } = await admin
    .from("event_tokens")
    .update({ token_cipher: encryptToken(token), revoked: false })
    .eq("id", data.id);
  if (failure) return { error: failure.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** The token out of a pasted `/e/<token>` address, or a bare token. */
function tokenIn(value: string): string | null {
  const trimmed = value.trim();
  const last = trimmed.split("?")[0].split("#")[0].split("/").pop() ?? "";
  return looksLikeToken(last) ? last : null;
}
