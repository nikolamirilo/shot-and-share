import { cx } from "@/lib/cx";

export function ProgressBar({
  percent,
  tone = "dark",
  indeterminate = false,
}: {
  percent: number;
  tone?: "dark" | "warn";
  /**
   * For work that is happening but cannot be measured - compressing a photo
   * reports nothing until it is finished. A bar sitting at zero reads as stuck,
   * so it drifts instead of filling.
   */
  indeterminate?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const track =
    "inset-shadow-well h-2.5 w-full overflow-hidden rounded-full bg-ink/12";
  // Ember is the shutter light and nothing else, so a full bar signals with
  // Rind and lets the copy next to it carry the urgency.
  const fill = tone === "warn" ? "bg-mist" : "bg-ink";

  if (indeterminate) {
    return (
      // No aria-valuenow: that is what tells a screen reader the amount is
      // unknown, rather than announcing a number that means nothing.
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
