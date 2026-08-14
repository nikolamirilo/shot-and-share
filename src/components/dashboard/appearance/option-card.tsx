"use client";

import { cx } from "@/lib/cx";

/**
 * One size for every option in this panel. Groups that size themselves resize
 * the panel as the host tabs between them, which reads as the page changing
 * rather than the group.
 */
export const OPTION_GRID = "grid gap-2.5 @min-[26rem]:grid-cols-2";
/**
 * Colours are two to a row at every width, unlike the option grids above.
 * A swatch is three dots and a word - it does not need the room a two-line
 * choice does, and eleven of them in one column is a list to scroll rather than
 * a palette to compare.
 */
export const SWATCH_GRID = "grid grid-cols-2 gap-2.5";
// Height is the whole selected state, nothing being outlined, so the two
// shadows are deliberately far apart rather than one step.
export const OPTION_CARD =
  "flex min-h-24 flex-col justify-center rounded-xl p-3.5 text-left transition-shadow";
export const OPTION_SELECTED = "bg-claret text-chalk shadow-lg";

export function Group({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
        {label}
      </p>
      {hint && <p className="mt-1 text-[0.8125rem] text-ash">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export function Swatch({
  selected,
  onClick,
  name,
  title,
  colors,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  name: string;
  title: string;
  colors: string[];
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={cx(
        OPTION_CARD,
        selected ? OPTION_SELECTED : "bg-linen shadow-sm",
        className,
      )}
    >
      {/* Big enough to judge a colour by. At the old size a theme was three
          dots about as wide as the full stop ending this sentence, and the
          only honest way to tell two of them apart was to click both. */}
      <span className="flex gap-1.5">
        {colors.map((c) => (
          <span
            key={c}
            className="inset-shadow-well h-7 w-7 rounded-full shadow-sm"
            style={{ background: c }}
          />
        ))}
      </span>
      <span className="mt-2 block text-[0.8125rem] font-semibold">{name}</span>
    </button>
  );
}

export function Choice({
  selected,
  onClick,
  name,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  name: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(OPTION_CARD, selected ? OPTION_SELECTED : "bg-linen shadow-sm")}
    >
      <span className="block font-bold leading-snug">{name}</span>
      <span
        className={cx(
          "mt-0.5 block text-[0.8125rem] leading-snug",
          selected ? "text-chalk/75" : "text-ash",
        )}
      >
        {hint}
      </span>
    </button>
  );
}
