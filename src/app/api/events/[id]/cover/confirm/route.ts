import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { findReadyMedia } from "@/lib/db/media-repo";
import { requireOwnedEvent } from "@/lib/host";
import { toMediaView } from "@/lib/media/view";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmReservation } from "@/lib/uploads/confirm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mediaId: z.string().uuid(),
  width: z.number().int().positive().max(60_000).nullable().optional(),
  height: z.number().int().positive().max(60_000).nullable().optional(),
  /** Whether the signed object actually made it into the bucket. */
  mediaUploaded: z.boolean().default(true),
  failed: z.boolean().default(false),
});

/**
 * Second half of the cover handshake, with `source = 'cover'` - which is what
 * keeps the host's own picture out of the gallery, the slideshow, the ZIP and
 * the photo count.
 *
 * The row comes back in the response. The picker has to show the new cover the
 * moment it lands, and re-rendering the whole console to fetch one thumbnail
 * would throw away the unsaved edits sitting in the panel around it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const event = await requireOwnedEvent(id);
    const body = await parseBody(request, bodySchema);

    const result = await confirmReservation({
      eventId: event.id,
      mediaId: body.mediaId,
      source: "cover",
      /*
       * A cover reservation is the only one with no fingerprint on it. Without
       * this check a host could hand this endpoint the id of a guest's
       * in-flight upload and have the guest's photograph written in as their
       * cover - and with `source = 'cover'` it would then vanish from the
       * gallery the guest uploaded it to.
       */
      claim: (media) => media.uploader_fingerprint === null,
      mediaUploaded: body.mediaUploaded && !body.failed,
      posterUploaded: false,
      width: body.width,
      height: body.height,
      log: "cover",
    });

    if (!result.confirmed) return ok({ confirmed: false, item: null });

    const row = await findReadyMedia(createAdminClient(), body.mediaId);
    return ok({
      confirmed: true,
      item: row ? await toMediaView(row) : null,
    });
  });
}
