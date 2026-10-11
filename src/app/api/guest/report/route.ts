import { z } from "zod";

import { ApiError, handle, ok, parseBody } from "@/lib/api";
import { findEventMedia } from "@/lib/db/media-repo";
import { photoReportedEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { requireGuestEvent } from "@/lib/guards/guest";
import { enforceRateLimit } from "@/lib/guards/rate-limit";
import { LIMITS } from "@/constants/limits";
import { clientIp } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS = ["not_allowed", "someone_in_it", "mistake", "other"] as const;

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  mediaId: z.string().uuid(),
  reason: z.enum(REASONS).default("other"),
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    enforceRateLimit(
      LIMITS.report,
      `report:${clientIp(request.headers)}`,
      "That has been sent. Give it a moment.",
    );

    const { event } = await requireGuestEvent(body.token);

    const admin = createAdminClient();
    const row = await findEventMedia(admin, {
      id: body.mediaId,
      eventId: event.id,
    });
    if (!row) throw new ApiError("not_found", "That photo is not here.");

    const { error } = await admin
      .from("media")
      .update({
        review_state: "reported",
        reported_at: row.reported_at ?? new Date().toISOString(),
        report_count: row.report_count + 1,
      })
      .eq("id", row.id)
      .eq("event_id", event.id);

    if (error) throw new Error(error.message);

    await notifyHost(event.owner_id, {
      eventId: event.id,
      eventName: event.name,
      reason: body.reason,
    });

    return ok({ reported: true });
  });
}

async function notifyHost(
  ownerId: string,
  args: { eventId: string; eventName: string; reason: string },
) {
  try {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("email")
      .eq("id", ownerId)
      .maybeSingle();

    const to = data?.email;
    if (!to) return;

    await sendEmail(
      photoReportedEmail({
        to,
        eventId: args.eventId,
        eventName: args.eventName,
        reason: args.reason,
        reviewUrl: `${env.siteUrl}/dashboard/events/${args.eventId}#event`,
      }),
    );
  } catch (error) {
    console.error("[report] could not notify the host", error);
  }
}
