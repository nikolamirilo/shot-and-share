"use server";

import { revalidatePath } from "next/cache";

import { requireOwnedEvent } from "@/lib/guards/host-action";
import type { ActionState } from "@/lib/actions/types";
import { issueTokenFor } from "@/lib/share-tokens";
import { createAdminClient } from "@/lib/supabase/admin";

async function revokeAll(eventId: string) {
  const { error } = await createAdminClient()
    .from("event_tokens")
    .update({ revoked: true })
    .eq("event_id", eventId)
    .eq("revoked", false);
  return error?.message ?? null;
}

export async function rotateShareLink(eventId: string): Promise<ActionState> {
  await requireOwnedEvent(eventId);

  const failure = await revokeAll(eventId);
  if (failure) return { error: failure };

  await issueTokenFor(eventId, "Reissued link");
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

export async function revokeShareLink(eventId: string): Promise<ActionState> {
  await requireOwnedEvent(eventId);

  const failure = await revokeAll(eventId);
  if (failure) return { error: failure };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}
