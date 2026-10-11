import "server-only";

import type { Appearance } from "@/lib/appearance";
import { findReadyMedia } from "@/lib/db/media-repo";
import { type EventRow } from "@/types/db";
import { toMediaView } from "@/lib/media/view";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CoverUrls {
  coverUrl: string | null;
  coverPreviewUrl: string | null;
}

export async function loadCoverUrls(
  event: Pick<EventRow, "cover_media_id">,
  appearance: Appearance,
): Promise<CoverUrls> {
  if (!event.cover_media_id || appearance.cover === "type") {
    return { coverUrl: null, coverPreviewUrl: null };
  }

  const row = await findReadyMedia(createAdminClient(), event.cover_media_id);
  if (!row || row.review_state !== "approved") {
    return { coverUrl: null, coverPreviewUrl: null };
  }

  const view = await toMediaView(row);
  // The full copy, not `previewUrl`: a 640px thumbnail is visibly soft across a whole
  // phone. The thumbnail is only the fallback.
  const coverUrl = view.fullUrl ?? view.previewUrl;

  return {
    coverUrl,
    coverPreviewUrl:
      view.previewUrl && view.previewUrl !== coverUrl ? view.previewUrl : null,
  };
}
