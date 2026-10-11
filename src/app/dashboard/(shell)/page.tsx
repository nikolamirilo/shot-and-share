import type { Metadata } from "next";

import { EventCard } from "@/components/dashboard/EventCard";
import { EventsEmptyState } from "@/components/dashboard/EventsEmptyState";
import { NewEventFab } from "@/components/dashboard/NewEventFab";
import { Eyebrow } from "@/components/ui";
import { listOwnEvents } from "@/lib/db/event-repo";
import { countGuestMediaExact } from "@/lib/db/media-repo";
import { env } from "@/lib/env";
import { getActiveShareTokens } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { shareUrl } from "@/lib/tokens";

export const metadata: Metadata = { title: "My events" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const events = await listOwnEvents(supabase);

  const [counts, tokens] = await Promise.all([
    Promise.all(events.map((event) => countGuestMediaExact(supabase, event.id))),
    getActiveShareTokens(events.map((event) => event.id)),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">
      <Eyebrow>Your events</Eyebrow>
      <h1 className="mt-3 text-[2.25rem] sm:text-h1">
        {events.length === 0
          ? "No events created."
          : `${events.length} ${events.length === 1 ? "event" : "events"}`}
      </h1>

      {events.length === 0 ? (
        <EventsEmptyState />
      ) : (
        <ul className="mt-7 grid grid-cols-1 gap-4 sm:mt-9 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {events.map((event, i) => {
            const token = tokens.get(event.id);
            return (
              <EventCard
                key={event.id}
                event={event}
                photoCount={counts[i]}
                shareLink={token ? shareUrl(env.siteUrl, token) : null}
              />
            );
          })}
        </ul>
      )}

      <NewEventFab />
    </div>
  );
}
