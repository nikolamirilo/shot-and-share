"use client";

import { cx } from "@/lib/cx";

/**
 * One size for every option in this panel.
 *
 * The groups used to size themselves: theme swatches were short and flowed to
 * fill a row, the rest were taller and came two to a row. Tabbing between them
 * moved the controls under the cursor and resized the panel, which reads as the
 * page changing rather than the group. One grid, one floor on the height, and
 * the only thing that changes between tabs is what the cards say.
 */
export const OPTION_GRID = "grid gap-2.5 @min-[26rem]:grid-cols-2";
// Unselected tiles rest on the panel; the chosen one comes up off it. That
// height difference is the whole selected state now that nothing is outlined,
// so the two shadows are deliberately far apart rather than one step.
export const OPTION_CARD =
  "flex min-h-24 flex-col justify-center rounded-xl p-3.5 text-left transition-shadow";
export const OPTION_SELECTED = "bg-gouda shadow-lg";

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
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
        {label}
      </p>
      {hint && <p className="mt-1 text-[0.8125rem] text-crust">{hint}</p>}
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
}: {
  selected: boolean;
  onClick: () => void;
  name: string;
  title: string;
  colors: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={cx(OPTION_CARD, selected ? OPTION_SELECTED : "bg-butter shadow-sm")}
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
      className={cx(OPTION_CARD, selected ? OPTION_SELECTED : "bg-butter shadow-sm")}
    >
      <span className="block font-bold leading-snug">{name}</span>
      <span className="mt-0.5 block text-[0.8125rem] leading-snug text-crust">
        {hint}
      </span>
    </button>
  );
}
