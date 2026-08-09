import type { Metadata } from "next";

import { EventCard } from "@/components/dashboard/event-card";
import { EventsEmptyState } from "@/components/dashboard/events-empty-state";
import { Eyebrow } from "@/components/ui";
import type { EventRow } from "@/lib/db/types";
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
        .eq("status", "ready")
        // A cover the host uploaded is decoration, not one of the photographs
        // this number is counting. See migration 0013.
        .eq("source", "guest");
      return count ?? 0;
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">
      <Eyebrow>Your events</Eyebrow>
      <h1 className="mt-3 text-[2.25rem] sm:text-h1">
        {events.length === 0
          ? "Nothing here yet."
          : `${events.length} ${events.length === 1 ? "event" : "events"}`}
      </h1>

      {events.length === 0 ? (
        <EventsEmptyState />
      ) : (
        <ul className="mt-7 grid gap-4 sm:mt-9 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {events.map((event, i) => (
            <EventCard key={event.id} event={event} photoCount={counts[i]} />
          ))}
        </ul>
      )}
    </div>
  );
}
