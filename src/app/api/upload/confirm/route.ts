import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { requireGuestEvent } from "@/lib/guards/guest";
import { confirmReservation } from "@/lib/uploads/confirm";
import { fingerprintSchema, shareTokenSchema } from "@/lib/uploads/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: shareTokenSchema,
  fingerprint: fingerprintSchema,
  mediaId: z.string().uuid(),
  width: z.number().int().positive().max(60_000).nullable().optional(),
  height: z.number().int().positive().max(60_000).nullable().optional(),
  mediaUploaded: z.boolean().default(true),
  posterUploaded: z.boolean().default(false),
  thumbUploaded: z.boolean().default(false),
  failed: z.boolean().default(false),
  reason: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);
    const { event } = await requireGuestEvent(body.token);

    const result = await confirmReservation({
      eventId: event.id,
      mediaId: body.mediaId,
      source: "guest",
      // Not authentication: it stops one guest's browser confirming another's upload.
      claim: (media) => media.uploader_fingerprint === body.fingerprint,
      mediaUploaded: body.mediaUploaded && !body.failed,
      posterUploaded: body.posterUploaded,
      thumbUploaded: body.thumbUploaded,
      width: body.width,
      height: body.height,
      reason: body.reason,
      log: "confirm",
      requireApproval: event.require_approval,
      autoScan: event.auto_scan,
    });

    return ok({
      confirmed: result.confirmed,
      held: result.confirmed ? Boolean(result.held) : false,
    });
  });
}
