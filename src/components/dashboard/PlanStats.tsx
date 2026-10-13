import { Badge, Stat } from "@/components/ui";
import { type storageSummary } from "@/lib/events";
import { formatBytes, formatCount } from "@/utils/format";

export function PlanStats({
  planName,
  photos,
  videos,
  uploaders,
  summary,
  video,
}: {
  planName: string;
  photos: number;
  videos: number;
  uploaders: number;
  summary: ReturnType<typeof storageSummary>;
  video: boolean;
}) {
  const tiles: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Photos", value: formatCount(photos) },
    {
      label: "Videos",
      value: video ? formatCount(videos) : "-",
      hint: video ? undefined : "Not on this plan",
    },
    {
      label: "Guests",
      value: formatCount(uploaders),
      hint: "Phones that uploaded",
    },
    {
      label: "Storage",
      value: formatBytes(summary.used),
      hint: `${summary.percent}% of ${formatBytes(summary.quota, 0)}`,
    },
  ];

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="eyebrow">This event so far</h2>
        <Badge tone="outline">{planName}</Badge>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Stat
            key={tile.label}
            label={tile.label}
            value={tile.value}
            hint={tile.hint}
          />
        ))}
      </dl>
    </section>
  );
}
