"use server";

import { revalidatePath } from "next/cache";

import { requireOwnedEvent } from "@/lib/actions/guards";
import type { ActionState } from "@/lib/actions/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The host's side of moderation: releasing something that was held.
 *
 * Deleting is not here. It is the same delete as any other photograph, and
 * giving the review queue its own destructive path would mean two places that
 * remove objects from a bucket.
 */
export async function approveMedia(
  eventId: string,
  mediaIds: string[],
): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  if (mediaIds.length === 0) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin
    .from("media")
    .update({ review_state: "approved" })
    .eq("event_id", eventId)
    .in("id", mediaIds);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}
