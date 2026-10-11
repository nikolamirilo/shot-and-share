import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { findReadyMedia } from "@/lib/db/media-repo";
import { requireOwnedEvent } from "@/lib/guards/host-api";
import { toMediaView } from "@/lib/media/view";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmReservation } from "@/lib/uploads/confirm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mediaId: z.string().uuid(),
  width: z.number().int().positive().max(60_000).nullable().optional(),
  height: z.number().int().positive().max(60_000).nullable().optional(),
  mediaUploaded: z.boolean().default(true),
  thumbUploaded: z.boolean().default(false),
  failed: z.boolean().default(false),
});

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
      claim: (media) => media.uploader_fingerprint === null,
      mediaUploaded: body.mediaUploaded && !body.failed,
      posterUploaded: false,
      thumbUploaded: body.thumbUploaded,
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
