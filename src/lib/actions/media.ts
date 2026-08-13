"use server";

import { revalidatePath } from "next/cache";

import { requireOwnedEvent } from "@/lib/actions/guards";
import type { ActionState } from "@/lib/actions/types";
import { findMediaByIds } from "@/lib/db/media-repo";
import { deleteMediaRows } from "@/lib/media/delete";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteMedia(
  eventId: string,
  mediaIds: string[],
): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  if (mediaIds.length === 0) return { ok: true };

  const admin = createAdminClient();
  const rows = await findMediaByIds(admin, eventId, mediaIds);
  await deleteMediaRows(eventId, rows);

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

export async function setCoverPhoto(
  eventId: string,
  mediaId: string | null,
): Promise<ActionState> {
  const { supabase } = await requireOwnedEvent(eventId);

  const { error } = await supabase
    .from("events")
    .update({ cover_media_id: mediaId })
    .eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}
