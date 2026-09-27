"use client";

import { cx } from "@/lib/cx";

export interface SegmentedOption<T extends string> {
  id: T;
  name: string;
  /** A count beside the name, such as how many photos are in a tab. */
  count?: number | null;
}

/**
 * A row of joined pills, one of them chosen. What the gallery uses to switch
 * between photos and videos and between its two orders - drawn like the
 * layout switcher, so the controls above a wall read as one set.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Read out to a screen reader; not drawn. */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("flex w-fit overflow-hidden rounded-full shadow-sm", className)}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cx(
            "min-h-9 whitespace-nowrap px-3 py-1.5 text-[0.8125rem] font-semibold leading-tight transition-colors",
            value === option.id
              ? "bg-claret text-chalk"
              : "bg-paper text-ink hover:bg-blush",
          )}
        >
          {option.name}
          {typeof option.count === "number" && (
            <span className="ml-1.5 font-mono text-[0.6875rem] opacity-70">
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
