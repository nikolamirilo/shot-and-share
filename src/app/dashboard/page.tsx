import type { Metadata } from "next";
import Link from "next/link";

import { Badge, ButtonLink, Eyebrow, Hole, ProgressBar } from "@/components/ui";
import type { EventRow } from "@/lib/db/types";
import { describeRetention, formatBytes, formatEventDate } from "@/lib/format";
import { storageSummary } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My events" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });

  const events = (data ?? []) as EventRow[];

  const counts = await Promise.all(
    events.map(async (event) => {
      const { count } = await supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "ready");
      return count ?? 0;
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <Eyebrow>Your events</Eyebrow>
      <h1 className="mt-3 text-h1">
        {events.length === 0
          ? "Nothing here yet."
          : `${events.length} ${events.length === 1 ? "event" : "events"}`}
      </h1>

      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => (
            <EventCard key={event.id} event={event} photoCount={counts[i]} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Empty states are invitations, not apologies. */
function EmptyState() {
  return (
    <div className="mt-8 max-w-xl">
      <p className="text-lead text-crust">
        Make an event, print the code, and send the link to one friend. Watch a
        photo arrive before you decide anything else.
      </p>
      <ButtonLink href="/dashboard/events/new" size="lg" className="mt-7">
        Create an event
      </ButtonLink>
    </div>
  );
}

function EventCard({
  event,
  photoCount,
}: {
  event: EventRow;
  photoCount: number;
}) {
  const summary = storageSummary(event);
  const expired = event.status === "expired";

  return (
    <li className="card flex flex-col p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/events/${event.id}`}
            className="block truncate text-[1.3rem] font-extrabold tracking-[-0.03em] hover:underline"
          >
            {event.name}
          </Link>
          <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
            {formatEventDate(event.event_date)}
          </p>
        </div>
        <Badge tone={expired ? "outline" : "gouda"}>
          {expired ? "Paused" : summary.tier.name}
        </Badge>
      </div>

      <div className="mt-5 flex items-center gap-2.5">
        <Hole size={11} />
        <span className="text-[0.9375rem]">
          {photoCount === 0
            ? "No photos yet"
            : `${photoCount.toLocaleString("en-GB")} ${photoCount === 1 ? "photo" : "photos"}`}
        </span>
      </div>

      <div className="mt-4">
        <ProgressBar
          percent={summary.percent}
          tone={summary.percent >= 85 ? "warn" : "dark"}
        />
        <p className="mt-2 flex items-baseline justify-between gap-2 text-[0.8125rem] text-crust">
          <span>
            {formatBytes(summary.used)} of {formatBytes(summary.quota, 0)}
          </span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-rind">
            {event.keep_forever
              ? "Kept forever"
              : describeRetention(event.expires_at)}
          </span>
        </p>
      </div>
    </li>
  );
}
