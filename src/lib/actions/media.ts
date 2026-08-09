"use server";

import { revalidatePath } from "next/cache";

import { requireOwnedEvent } from "@/lib/actions/guards";
import type { ActionState } from "@/lib/actions/types";
import { mediaBytes, mediaKeys } from "@/lib/media";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteMedia(
  eventId: string,
  mediaIds: string[],
): Promise<ActionState> {
  const { event } = await requireOwnedEvent(eventId);
  if (mediaIds.length === 0) return { ok: true };

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("media")
    .select("*")
    .eq("event_id", eventId)
    .in("id", mediaIds)
    .neq("status", "deleted");

  if (error) return { error: error.message };
  if (!rows || rows.length === 0) return { ok: true };

  const keys = rows.flatMap((row) => mediaKeys(row));
  const bytes = rows.reduce((sum, row) => sum + mediaBytes(row), 0);

  await storage.remove(keys);
  await admin
    .from("media")
    .update({ status: "deleted" })
    .eq("event_id", eventId)
    .in(
      "id",
      rows.map((r) => r.id),
    );
  await admin.rpc("release_storage", { p_event: eventId, p_bytes: bytes });

  /*
   * A deleted photo cannot go on being the cover. Left pointing at it the event
   * page looks up a row that is no longer readable and falls back to "Just
   * type", which reads as the cover style having broken rather than as the
   * photograph having been removed - and the picker would show nothing
   * selected while the row still named one.
   */
  if (event.cover_media_id && rows.some((row) => row.id === event.cover_media_id)) {
    await admin
      .from("events")
      .update({ cover_media_id: null })
      .eq("id", eventId);
  }

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */

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
