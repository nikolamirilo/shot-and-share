import "server-only";

import { purge } from "@/lib/cdn/purge";
import { type MediaRow } from "@/types/db";
import { mediaBytes, mediaKeys } from "@/lib/media/keys";
import { storage } from "@/lib/storage";
import { release } from "@/lib/storage/quota";
import { createAdminClient } from "@/lib/supabase/admin";

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
  await purge(keys);

  return { removed: rows.length, bytes };
}

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
