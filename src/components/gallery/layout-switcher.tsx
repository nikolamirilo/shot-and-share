"use client";

import { cx } from "@/lib/cx";
import { GALLERY_LAYOUTS, type GalleryLayout } from "@/lib/gallery";

export function LayoutSwitcher({
  value,
  onChange,
  label = "Layout",
}: {
  value: GalleryLayout;
  onChange: (layout: GalleryLayout) => void;
  label?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label="Gallery layout"
        className="flex overflow-hidden rounded-full shadow-sm"
      >
        {GALLERY_LAYOUTS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            title={option.hint}
            onClick={() => onChange(option.id)}
            className={cx(
              "min-h-9 px-3 py-1.5 text-[0.8125rem] font-semibold leading-tight transition-colors",
              value === option.id
                ? "bg-claret text-chalk"
                : "bg-paper text-ink hover:bg-blush",
            )}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}

