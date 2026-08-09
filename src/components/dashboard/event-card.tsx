import Link from "next/link";

import { Badge, Hole, ProgressBar } from "@/components/ui";
import type { EventRow } from "@/lib/db/types";
import { storageSummary } from "@/lib/events";
import { describeRetention, formatBytes, formatEventDate } from "@/lib/format";

export function EventCard({
  event,
  photoCount,
}: {
  event: EventRow;
  photoCount: number;
}) {
  const summary = storageSummary(event);
  const expired = event.status === "expired";

  return (
    /**
     * The whole card is the link, not the event's name inside it. There is
     * nothing else interactive in here, and on a phone a 20px line of text is
     * a target you have to aim at - the card is one you cannot miss.
     */
    <li>
      <Link
        href={`/dashboard/events/${event.id}`}
        className="card flex h-full flex-col p-5 transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block truncate text-[1.3rem] font-extrabold tracking-[-0.03em]">
              {event.name}
            </span>
            <span className="mt-0.5 block font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
              {formatEventDate(event.event_date)}
            </span>
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
          <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[0.8125rem] text-crust">
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
      </Link>
    </li>
  );
}
