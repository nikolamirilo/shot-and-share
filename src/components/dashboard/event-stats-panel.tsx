import { ButtonLink, Hole, Panel, ProgressBar, Stat } from "@/components/ui";
import type { EventRow } from "@/lib/db/types";
import { describeRetention, formatBytes, pluralise } from "@/lib/format";
import type { storageSummary } from "@/lib/events";

/**
 * How the night is going, in four numbers and a bar.
 *
 * The fourth number - opened, then uploaded - is the one that predicts whether
 * the product works. A guest who scans the code and does not upload is the
 * clearest signal of a broken experience, so it belongs on the host's own page
 * rather than in an analytics tool none of them will open.
 */
export function EventStatsPanel({
  event,
  photoCount,
  uploaderCount,
  summary,
  slideshow,
}: {
  event: EventRow;
  photoCount: number;
  uploaderCount: number;
  summary: ReturnType<typeof storageSummary>;
  /** The live slideshow is a paid feature; no button when it is not bought. */
  slideshow: boolean;
}) {
  const conversion =
    event.link_opens > 0
      ? Math.min(100, Math.round((uploaderCount / event.link_opens) * 100))
      : null;

  return (
    <Panel title="How it is going">

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
        <Stat label="Photos" value={photoCount.toLocaleString("en-GB")} />
        <Stat
          label="People who uploaded"
          value={uploaderCount.toLocaleString("en-GB")}
        />
        <Stat label="Link opened" value={pluralise(event.link_opens, "time")} />
        <Stat
          label="Opened then uploaded"
          value={conversion === null ? "-" : `${conversion}%`}
          hint={
            conversion === null
              ? "No opens yet"
              : conversion < 40
                ? "Low. Check the code is easy to reach."
                : "Healthy"
          }
        />
      </dl>

      <div className="mt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            Storage
          </span>
          <span className="text-[0.8125rem] tabular-nums text-ash">
            {formatBytes(summary.used)} of {formatBytes(summary.quota, 0)}
          </span>
        </div>
        <div className="mt-2">
          <ProgressBar
            percent={summary.percent}
            tone={summary.percent >= 85 ? "warn" : "dark"}
          />
        </div>
        <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-snug text-ash">
          <Hole size={8} className="mt-1.5" />
          {event.keep_forever
            ? "Kept forever. This event is never deleted."
            : describeRetention(event.expires_at)}
        </p>
      </div>

      {slideshow && (
        <ButtonLink
          href={`/dashboard/events/${event.id}/slideshow`}
          variant="secondary"
          className="mt-6 w-full"
        >
          Open the live slideshow
        </ButtonLink>
      )}
    </Panel>
  );
}
