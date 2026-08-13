import { fail, handle, ok } from "@/lib/api";
import {
  listEventsToPurge,
  listExpiredEvents,
  listExpiringEvents,
} from "@/lib/db/event-repo";
import {
  eventExpiredEmail,
  retentionWarningEmail,
  sendEmail,
} from "@/lib/email";
import { env } from "@/lib/env";
import { eventPrefix, mediaBytes, mediaKeys, scopeOfEvent } from "@/lib/media";
import { storage } from "@/lib/storage";
import { release } from "@/lib/storage/quota";
import { createAdminClient } from "@/lib/supabase/admin";
import { HARD_DELETE_GRACE_DAYS, RETENTION_WARNING_DAYS } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The daily retention job.
 *
 * Deletion here is slow, warned about repeatedly, and reversible for a grace
 * period. Losing someone's wedding photos to a scheduling bug is the failure
 * this product cannot survive, so the destructive step is always the last one
 * and always delayed:
 *
 *   warn at 14, 7 and 1 days  ->  expire (nothing removed)  ->  wait 14 days
 *   ->  hard delete
 *
 * A host can restore the event, or buy The Archive, at any point before the last
 * arrow.
 */
export async function GET(request: Request) {
  return run(request);
}
export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  return handle(async () => {
    if (!env.cronSecret) {
      return fail("not_configured", "CRON_SECRET is not set.");
    }
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${env.cronSecret}`) {
      return fail("unauthorized", "Bad cron secret.");
    }

    const summary = {
      reservationsSwept: 0,
      warned: 0,
      expired: 0,
      hardDeleted: 0,
      objectsRemoved: 0,
    };

    await sweepStaleReservations(summary);
    await sendWarnings(summary);
    await expireEvents(summary);
    await hardDelete(summary);

    return ok(summary);
  });
}

/* -------------------------------------------------------------------------- */

/**
 * How long a promise of storage outlives the guest who was given it.
 *
 * Two hours rather than the day the old pending-row sweep waited, because a
 * reservation is now cheap bookkeeping instead of a media row, and quota held
 * by an upload that will never happen is quota the host paid for. It still has
 * to clear the slowest real upload: 200 MB is the largest single file any tier
 * allows, which is about an hour on genuinely bad wifi, and the client's own
 * stall watchdog gives up long before that if the connection has actually died.
 */
const RESERVATION_TTL_MS = 2 * 3600_000;

/**
 * Uploads that reserved quota and never confirmed - a phone that died halfway,
 * a tab closed mid-batch. The bytes may or may not be in the bucket, so the
 * reservation is returned and any object is removed.
 */
async function sweepStaleReservations(summary: { reservationsSwept: number }) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MS).toISOString();

  const { data: rows } = await admin
    .from("upload_reservations")
    .select("*")
    .lt("created_at", cutoff)
    .limit(500);

  for (const row of rows ?? []) {
    /*
     * A confirm that wrote the media row and then failed to delete its own
     * reservation leaves one behind pointing at a photo the host can see. This
     * check is the difference between tidying up and deleting somebody's
     * wedding photo, so it happens before anything is removed.
     */
    const { data: live } = await admin
      .from("media")
      .select("id")
      .eq("id", row.id)
      .maybeSingle();

    if (live) {
      await admin.from("upload_reservations").delete().eq("id", row.id);
      continue;
    }

    await storage.remove(mediaKeys(row));
    await admin.from("upload_reservations").delete().eq("id", row.id);
    await release(row.event_id, mediaBytes(row));
    summary.reservationsSwept += 1;
  }
}

/* -------------------------------------------------------------------------- */

async function sendWarnings(summary: { warned: number }) {
  const admin = createAdminClient();
  const horizon = new Date(
    Date.now() + Math.max(...RETENTION_WARNING_DAYS) * 86_400_000,
  ).toISOString();

  const events = await listExpiringEvents(admin, horizon, 500);

  for (const event of events) {
    if (!event.expires_at || !event.profiles?.email) continue;

    const daysLeft = Math.ceil(
      (new Date(event.expires_at).getTime() - Date.now()) / 86_400_000,
    );
    // The tightest threshold this event has now crossed.
    const threshold = RETENTION_WARNING_DAYS.filter((d) => daysLeft <= d).pop();
    if (threshold === undefined) continue;

    // warned_at_days records the last threshold sent, so each one goes out once.
    if (event.warned_at_days !== null && event.warned_at_days <= threshold) {
      continue;
    }

    const { count } = await admin
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "ready");

    await sendEmail(
      retentionWarningEmail({
        to: event.profiles.email,
        eventName: event.name,
        days: Math.max(1, daysLeft),
        photoCount: count ?? 0,
        downloadUrl: `${env.siteUrl}/dashboard/events/${event.id}`,
      }),
    );

    await admin
      .from("events")
      .update({ warned_at_days: threshold })
      .eq("id", event.id);
    summary.warned += 1;
  }
}

/* -------------------------------------------------------------------------- */

/** Expiry removes nothing. It starts a clock and sends one more email. */
async function expireEvents(summary: { expired: number }) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const events = await listExpiredEvents(admin, now, 500);

  for (const event of events) {
    await admin
      .from("events")
      .update({ status: "expired", deleted_at: now })
      .eq("id", event.id);

    if (event.profiles?.email) {
      await sendEmail(
        eventExpiredEmail({
          to: event.profiles.email,
          eventName: event.name,
          graceDays: HARD_DELETE_GRACE_DAYS,
          restoreUrl: `${env.siteUrl}/dashboard/events/${event.id}`,
        }),
      );
    }
    summary.expired += 1;
  }
}

/* -------------------------------------------------------------------------- */

/** The only destructive step, and it runs a fortnight after the last warning. */
async function hardDelete(summary: {
  hardDeleted: number;
  objectsRemoved: number;
}) {
  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - HARD_DELETE_GRACE_DAYS * 86_400_000,
  ).toISOString();

  const events = await listEventsToPurge(admin, cutoff, 50);

  for (const event of events) {
    summary.objectsRemoved += await storage.removePrefix(
      eventPrefix(scopeOfEvent(event)),
    );
    // media and event_tokens cascade. Purchase rows survive with a null event,
    // because the accounting record of a payment must outlive the photos.
    await admin.from("events").delete().eq("id", event.id);
    summary.hardDeleted += 1;
  }
}
