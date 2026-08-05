"use client";

import type { ReactNode } from "react";

import { cx } from "@/components/ui";
import type { MediaView } from "@/lib/events";
import {
  GALLERY_LAYOUTS,
  type GalleryLayout,
  aspectRatio,
  holeSize,
} from "@/lib/gallery";

/**
 * One gallery, four shapes, used by both the guest page and the host dashboard.
 *
 * The host selects and deletes; the guest opens a lightbox. Rather than two
 * components drifting apart, the difference is one callback and an optional
 * selected set - everything about how a photo is *presented* stays in one place.
 */
export function PhotoGallery({
  items,
  layout,
  onActivate,
  isSelected,
  className,
}: {
  items: MediaView[];
  layout: GalleryLayout;
  onActivate: (item: MediaView) => void;
  /** Host mode. Omit entirely for a read-only gallery. */
  isSelected?: (item: MediaView) => boolean;
  className?: string;
}) {
  if (layout === "holes") {
    return (
      <ul
        className={cx(
          "hole-wall flex flex-wrap items-center gap-2.5 sm:gap-3",
          className,
        )}
      >
        {items.map((item, index) => {
          // `--hole-scale` comes from .hole-wall and shrinks the whole
          // sequence on a phone, keeping the rhythm between sizes intact.
          const size = `calc(${holeSize(index)}px * var(--hole-scale, 1))`;
          return (
            <li key={item.id}>
              <Tile
                item={item}
                onActivate={onActivate}
                selected={isSelected?.(item) ?? false}
                selectable={Boolean(isSelected)}
                shape="hole"
                style={{ width: size, height: size }}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  if (layout === "masonry") {
    return (
      /**
       * CSS columns rather than a JS masonry library: no measuring pass, no
       * layout thrash when a photo loads, and it reflows for free. The known
       * cost is that reading order runs down each column instead of across -
       * acceptable for a photo wall where nothing depends on sequence.
       */
      <ul
        className={cx(
          "columns-2 gap-2 sm:columns-3 sm:gap-2.5 lg:columns-4 [&>li]:mb-2 sm:[&>li]:mb-2.5",
          className,
        )}
      >
        {items.map((item) => (
          <li key={item.id} className="break-inside-avoid">
            <Tile
              item={item}
              onActivate={onActivate}
              selected={isSelected?.(item) ?? false}
              selectable={Boolean(isSelected)}
              shape="recess"
              style={{
                aspectRatio: aspectRatio(item.width, item.height),
                width: "100%",
              }}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (layout === "stack") {
    return (
      <ul className={cx("mx-auto max-w-2xl space-y-4", className)}>
        {items.map((item) => (
          <li key={item.id}>
            <Tile
              item={item}
              onActivate={onActivate}
              selected={isSelected?.(item) ?? false}
              selectable={Boolean(isSelected)}
              shape="recess"
              /**
               * No forced aspect ratio here, unlike Masonry: the tile takes the
               * photo's own height. Masonry needs the stored ratio to reserve
               * column space before the image loads, but Stack is one column,
               * so the only thing a declared ratio can do is disagree with the
               * actual thumbnail - an EXIF rotation we did not account for -
               * and letterbox the photo in dark bars.
               *
               * Full-resolution originals would be the obvious choice at this
               * size and the wrong one: a 4 MB photo per row, fifty rows, on
               * venue wifi. The 720px thumbnail holds up.
               */
              natural
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      className={cx(
        "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-6",
        className,
      )}
    >
      {items.map((item) => (
        <li key={item.id}>
          <Tile
            item={item}
            onActivate={onActivate}
            selected={isSelected?.(item) ?? false}
            selectable={Boolean(isSelected)}
            shape="recess"
            className="aspect-square w-full"
          />
        </li>
      ))}
    </ul>
  );
}

function Tile({
  item,
  onActivate,
  selected,
  selectable,
  shape,
  style,
  className,
  natural = false,
}: {
  item: MediaView;
  onActivate: (item: MediaView) => void;
  selected: boolean;
  selectable: boolean;
  shape: "hole" | "recess";
  style?: React.CSSProperties;
  className?: string;
  /** Let the image set the tile's height instead of cropping into a box. */
  natural?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onActivate(item)}
      aria-pressed={selectable ? selected : undefined}
      aria-label={
        selectable
          ? `Select this ${item.kind}`
          : `Open this ${item.kind}${item.uploaderName ? ` from ${item.uploaderName}` : ""}`
      }
      style={style}
      className={cx(
        shape,
        "relative block overflow-hidden transition-transform",
        selected
          ? "scale-95 ring-4 ring-pepper ring-offset-2 ring-offset-butter"
          : "hover:scale-[1.03]",
        className,
      )}
    >
      {item.thumbUrl ? (
        <img
          src={item.thumbUrl}
          alt=""
          loading="lazy"
          className={cx(
            "w-full",
            natural ? "h-auto align-top" : "h-full object-cover",
          )}
        />
      ) : (
        <span
          className={cx(
            "flex w-full items-center justify-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-gouda-light",
            natural ? "aspect-[4/3]" : "h-full",
          )}
        >
          {item.kind}
        </span>
      )}

      {item.kind === "video" && (
        <span className="absolute bottom-1 left-1 rounded-full bg-pepper px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-butter">
          video
        </span>
      )}
    </button>
  );
}

/**
 * The viewer's switch. Deliberately small and out of the way - it is a
 * preference, not a call to action, and the photos are the point of the page.
 */
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
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label="Gallery layout"
        className="flex overflow-hidden rounded-full border-2 border-pepper"
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
                ? "bg-pepper text-butter"
                : "bg-cream text-pepper hover:bg-gouda-light",
            )}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Host-facing picker, with room to explain what each one does. */
export function LayoutChooser({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: GalleryLayout;
}): ReactNode {
  return (
    <fieldset>
      <legend className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
        Gallery layout
      </legend>
      <p className="mt-1.5 text-[0.9375rem] text-crust">
        How guests see the shared gallery when they arrive. They can switch it
        for themselves afterwards; this is the one they land on.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {GALLERY_LAYOUTS.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-pepper bg-butter p-3.5 has-[:checked]:bg-gouda"
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              defaultChecked={option.id === defaultValue}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#1F1607]"
            />
            <span>
              <span className="block font-bold">{option.name}</span>
              <span className="block text-[0.8125rem] leading-snug text-crust">
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
