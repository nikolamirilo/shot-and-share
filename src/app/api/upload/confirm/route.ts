import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { requireGuestEvent } from "@/lib/events";
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
  /** Which of the signed objects actually made it into the bucket. */
  mediaUploaded: z.boolean().default(true),
  posterUploaded: z.boolean().default(false),
  failed: z.boolean().default(false),
  /**
   * Why the browser gave up, in the app's own words.
   *
   * The upload goes straight from the phone to the bucket, so when it fails
   * there is no request on our side to look at. A bucket whose CORS rules do
   * not name the live hostname looks exactly like a guest on bad wifi from
   * here, and the two need completely different repairs.
   */
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
      // The fingerprint is the only thing tying a reservation to the guest who
      // asked for it. It is not authentication - it is what stops one guest's
      // browser confirming another's upload by guessing a uuid.
      claim: (media) => media.uploader_fingerprint === body.fingerprint,
      mediaUploaded: body.mediaUploaded && !body.failed,
      posterUploaded: body.posterUploaded,
      width: body.width,
      height: body.height,
      reason: body.reason,
      log: "confirm",
    });

    return ok({ confirmed: result.confirmed });
  });
}
