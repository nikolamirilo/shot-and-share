import Link from "next/link";

import { EventCardMenu } from "@/components/dashboard/event-card-menu";
import { Badge, Hole, ProgressBar } from "@/components/ui";
import type { EventRow } from "@/lib/db/types";
import { storageSummary } from "@/lib/events";
import { describeRetention, formatBytes, formatEventDate } from "@/lib/format";

export function EventCard({
  event,
  photoCount,
  shareLink,
}: {
  event: EventRow;
  photoCount: number;
  /** The live guest link, for the menu's copy. Null when it has been revoked. */
  shareLink: string | null;
}) {
  const summary = storageSummary(event);
  const expired = event.status === "expired";

  return (
    /**
     * The whole card is the link, not the event's name inside it. On a phone a
     * 20px line of text is a target you have to aim at - the card is one you
     * cannot miss.
     *
     * It is stretched out of the name rather than wrapped around everything,
     * because the card now also holds a menu, and a button inside an anchor is
     * neither valid markup nor reliably clickable.
     */
    <li className="card relative flex h-full flex-col p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/events/${event.id}`}
            className="block after:absolute after:inset-0 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span className="block truncate text-[1.3rem] font-extrabold tracking-[-0.03em]">
              {event.name}
            </span>
          </Link>
          <span className="mt-0.5 block font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            {formatEventDate(event.event_date)}
          </span>
        </div>

        {/* Above the stretched link, or the menu is a button you cannot press. */}
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <Badge tone={expired ? "outline" : "brand"}>
            {expired ? "Paused" : summary.tier.name}
          </Badge>
          <EventCardMenu
            eventId={event.id}
            eventName={event.name}
            shareLink={shareLink}
          />
        </div>
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
        <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[0.8125rem] text-ash">
          <span>
            {formatBytes(summary.used)} of {formatBytes(summary.quota, 0)}
          </span>
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-mist">
            {event.keep_forever
              ? "Kept forever"
              : describeRetention(event.expires_at)}
          </span>
        </p>
      </div>
    </li>
  );
}
