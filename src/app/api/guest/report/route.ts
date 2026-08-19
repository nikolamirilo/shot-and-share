import { z } from "zod";

import { ApiError, handle, ok, parseBody } from "@/lib/api";
import { findEventMedia } from "@/lib/db/media-repo";
import { photoReportedEmail, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { requireGuestEvent } from "@/lib/events";
import { enforceRateLimit } from "@/lib/guards";
import { LIMITS, clientIp } from "@/lib/ratelimit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A guest reporting a photograph.
 *
 * Hidden first, asked about afterwards. The whole value of a report button is
 * that the thing being reported stops being on a wall in front of everybody
 * within a second, and every alternative - a queue, a threshold, a human
 * looking first - leaves it up while somebody decides.
 *
 * That also makes it an obvious way to spoil an event, and the answer to that
 * is not to make reporting harder. It is that the host is emailed immediately,
 * sees exactly what was hidden, and puts it back in one click.
 */

const REASONS = ["not_allowed", "someone_in_it", "mistake", "other"] as const;

const bodySchema = z.object({
  token: z.string().min(20).max(64),
  mediaId: z.string().uuid(),
  reason: z.enum(REASONS).default("other"),
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    // One phone cannot empty a gallery by holding the button down.
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

    /*
     * Reporting something already reported succeeds. Two guests pressing the
     * button on the same photograph within a second of each other is the normal
     * case, and the second one should not be told they got it wrong. The first
     * report's timestamp is the one kept.
     */
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

/**
 * The host is the only person who can act on this, so they hear about it now
 * rather than the next time they happen to open the dashboard.
 *
 * Nothing in here may fail the request. The photograph is already down, which
 * is the part the guest was promised, and a bounced email must not turn that
 * into an error on their phone.
 */
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
        reviewUrl: `${env.siteUrl}/dashboard/events/${args.eventId}#photos`,
      }),
    );
  } catch (error) {
    console.error("[report] could not notify the host", error);
  }
}
