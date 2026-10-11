import { fail, handle, ok } from "@/lib/api";
import { purgePrefix } from "@/lib/cdn/purge";
import { countReadyMedia, mediaExistsById } from "@/lib/db/media-repo";
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
import {
  HARD_DELETE_GRACE_DAYS,
  RETENTION_WARNING_DAYS,
  getTier,
  keepingFor,
} from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

const RESERVATION_TTL_MS = 4 * 3600_000;

async function sweepStaleReservations(summary: { reservationsSwept: number }) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MS).toISOString();

  const { data: rows } = await admin
    .from("upload_reservations")
    .select("*")
    .lt("created_at", cutoff)
    .limit(500);

  for (const row of rows ?? []) {
    if (await mediaExistsById(admin, row.id)) {
      await admin.from("upload_reservations").delete().eq("id", row.id);
      continue;
    }

    await storage.remove(mediaKeys(row));
    await admin.from("upload_reservations").delete().eq("id", row.id);
    await release(row.event_id, mediaBytes(row));
    summary.reservationsSwept += 1;
  }
}

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
    const threshold = RETENTION_WARNING_DAYS.filter((d) => daysLeft <= d).pop();
    if (threshold === undefined) continue;

    if (event.warned_at_days !== null && event.warned_at_days <= threshold) {
      continue;
    }

    const photoCount = await countReadyMedia(admin, event.id);

    const keeping = keepingFor(getTier(event.tier));

    await sendEmail(
      retentionWarningEmail({
        to: event.profiles.email,
        eventName: event.name,
        days: Math.max(1, daysLeft),
        photoCount,
        downloadUrl: `${env.siteUrl}/dashboard/events/${event.id}`,
        keepingPriceEur: keeping?.priceEur ?? null,
      }),
    );

    await admin
      .from("events")
      .update({ warned_at_days: threshold })
      .eq("id", event.id);
    summary.warned += 1;
  }
}

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
    const prefix = eventPrefix(scopeOfEvent(event));
    summary.objectsRemoved += await storage.removePrefix(prefix);
    await purgePrefix(prefix);
    await admin.from("events").delete().eq("id", event.id);
    summary.hardDeleted += 1;
  }
}
