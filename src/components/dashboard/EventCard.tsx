import Link from "next/link";

import { EventCardMenu } from "@/components/dashboard/EventCardMenu";
import { Badge, ButtonLink, Hole, ProgressBar } from "@/components/ui";
import { type EventRow } from "@/types/db";
import { storageSummary } from "@/lib/events";
import { describeRetention, formatBytes } from "@/utils/format";
import { formatCount } from "@/utils/format";

export function EventCard({
  event,
  photoCount,
  shareLink,
}: {
  event: EventRow;
  photoCount: number;
  shareLink: string | null;
}) {
  const summary = storageSummary(event);
  const expired = event.status === "expired";

  return (
    <li className="card relative flex h-full min-w-0 flex-col p-5 transition-transform hover:-translate-y-0.5">
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
        </div>

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
            : `${formatCount(photoCount)} ${photoCount === 1 ? "photo" : "photos"}`}
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

      <div className="relative z-10 mt-auto pt-5">
        <ButtonLink
          href={`/dashboard/events/${event.id}`}
          size="sm"
          aria-label={`View ${event.name}`}
          className="w-full"
        >
          View event
        </ButtonLink>
      </div>
    </li>
  );
}
