"use client";

import { cx } from "@/utils/cx";

export interface SegmentedOption<T extends string> {
  id: T;
  name: string;
  count?: number | null;
}

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
