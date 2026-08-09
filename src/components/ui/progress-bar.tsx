import { cx } from "@/lib/cx";

export function ProgressBar({
  percent,
  tone = "dark",
}: {
  percent: number;
  tone?: "dark" | "warn";
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="inset-shadow-well h-2.5 w-full overflow-hidden rounded-full bg-pepper/12"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Ember is the shutter light and nothing else, so a full bar signals
          with Rind and lets the copy next to it carry the urgency. */}
      <div
        className={cx(
          "h-full transition-[width] duration-300",
          tone === "warn" ? "bg-rind" : "bg-pepper",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
