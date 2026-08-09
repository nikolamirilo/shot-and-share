"use server";

import { revalidatePath } from "next/cache";

import { requireOwnedEvent } from "@/lib/actions/guards";
import type { ActionState } from "@/lib/actions/types";
import { issueTokenFor } from "@/lib/share-tokens";
import { createAdminClient } from "@/lib/supabase/admin";

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
