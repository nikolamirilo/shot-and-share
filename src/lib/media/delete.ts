import "server-only";

import type { MediaRow } from "@/lib/db/types";
import { mediaBytes, mediaKeys } from "@/lib/media/keys";
import { storage } from "@/lib/storage";
import { release } from "@/lib/storage/quota";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Removing photographs, in the one order that is safe.
 *
 * Objects first, then the row, then the quota. Three call sites wrote this out
 * by hand and one of them forgot the cover check, which left the event page
 * pointing at a photograph that no longer existed.
 */
export async function deleteMediaRows(
  eventId: string,
  rows: MediaRow[],
): Promise<{ removed: number; bytes: number }> {
  if (rows.length === 0) return { removed: 0, bytes: 0 };

  const keys = rows.flatMap((row) => mediaKeys(row));
  const bytes = rows.reduce((sum, row) => sum + mediaBytes(row), 0);
  const admin = createAdminClient();

  await storage.remove(keys);
  await admin
    .from("media")
    .update({ status: "deleted" })
    .eq("event_id", eventId)
    .in(
      "id",
      rows.map((row) => row.id),
    );
  await release(eventId, bytes);
  await clearCoverIfDeleted(eventId, rows);

  return { removed: rows.length, bytes };
}

/**
 * A deleted photograph cannot go on being the cover. Left pointing at it the
 * event page falls back to the plain cover, which reads as the cover style
 * having broken rather than as the photograph having been removed.
 */
async function clearCoverIfDeleted(eventId: string, rows: MediaRow[]) {
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("cover_media_id")
    .eq("id", eventId)
    .maybeSingle();

  const cover = event?.cover_media_id;
  if (!cover || !rows.some((row) => row.id === cover)) return;

  await admin
    .from("events")
    .update({ cover_media_id: null })
    .eq("id", eventId);
}
