import { Hole, Panel, ProgressBar } from "@/components/ui";
import { type EventRow } from "@/types/db";
import { describeRetention, formatBytes } from "@/utils/format";
import { type storageSummary } from "@/lib/events";

export function StoragePanel({
  event,
  summary,
}: {
  event: EventRow;
  summary: ReturnType<typeof storageSummary>;
}) {
  return (
    <Panel title="Room and time">
      <div className="mt-5">
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
    </Panel>
  );
}
