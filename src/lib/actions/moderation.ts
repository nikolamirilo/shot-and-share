"use server";

import { revalidatePath } from "next/cache";

import { requireOwnedEvent } from "@/lib/guards/host-action";
import type { ActionState } from "@/lib/actions/types";
import { createAdminClient } from "@/lib/supabase/admin";

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
