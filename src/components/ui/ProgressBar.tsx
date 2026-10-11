import { cx } from "@/utils/cx";

export function ProgressBar({
  percent,
  tone = "dark",
  indeterminate = false,
}: {
  percent: number;
  tone?: "dark" | "warn";
  indeterminate?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const track =
    "inset-shadow-well h-2.5 w-full overflow-hidden rounded-full bg-ink/12";
  const fill = tone === "warn" ? "bg-mist" : "bg-ink";

  if (indeterminate) {
    return (
      <div
        className={track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cx("progress-drift h-full w-2/5 rounded-full", fill)} />
      </div>
    );
  }

  return (
    <div
      className={track}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx("h-full transition-[width] duration-300", fill)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
