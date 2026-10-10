import "server-only";

import type { Appearance } from "@/lib/appearance";
import { findReadyMedia } from "@/lib/db/media-repo";
import type { EventRow } from "@/lib/db/types";
import { toMediaView } from "@/lib/media/view";
import { createAdminClient } from "@/lib/supabase/admin";

/** The two copies of the cover a page renders. Both null when there is none. */
export interface CoverUrls {
  coverUrl: string | null;
  /**
   * The cover's thumbnail, which stands in blurred while the full copy is in
   * flight - see components/event/cover-image.tsx. Null when the row has none,
   * or when it is already what `coverUrl` is serving.
   */
  coverPreviewUrl: string | null;
}

/**
 * The cover photograph, resolved once for everyone who draws an event.
 *
 * Shared by the guest page and the host's console, because they have to agree:
 * the console's Event tab is there to show the host what guests get, and a
 * second copy of this logic is how the two quietly stop matching.
 */
export async function loadCoverUrls(
  event: Pick<EventRow, "cover_media_id">,
  appearance: Appearance,
): Promise<CoverUrls> {
  if (!event.cover_media_id || appearance.cover === "type") {
    return { coverUrl: null, coverPreviewUrl: null };
  }

  const row = await findReadyMedia(createAdminClient(), event.cover_media_id);
  // A cover held by the automated check falls back to the typographic header
  // rather than filling a guest's whole screen with it.
  if (!row || row.review_state !== "approved") {
    return { coverUrl: null, coverPreviewUrl: null };
  }

  const view = await toMediaView(row);
  // The full copy, not `previewUrl`. That one is the 640px thumbnail the
  // gallery grid loads fifty of, and the cover is the opposite case: one
  // photograph across a whole phone, where 640px is visibly soft. The
  // thumbnail is only the fallback, for a row with no full copy - one still
  // waiting on the worker, or written before the folders existed.
  const coverUrl = view.fullUrl ?? view.previewUrl;

  return {
    coverUrl,
    /*
     * And the thumbnail as well, to stand in while those two megabytes are in
     * flight. Not when it is already the cover being served: there is nothing
     * to fade a photograph in over except itself.
     */
    coverPreviewUrl:
      view.previewUrl && view.previewUrl !== coverUrl ? view.previewUrl : null,
  };
}
