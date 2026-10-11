"use client";

import {
  MdFormatAlignCenter,
  MdFormatAlignLeft,
  MdFormatAlignRight,
  MdVerticalAlignBottom,
  MdVerticalAlignCenter,
  MdVerticalAlignTop,
} from "react-icons/md";

import { cx } from "@/utils/cx";
import {
  COVER_HORIZONTALS,
  COVER_VERTICALS,
  type CoverHorizontal,
  type CoverPosition,
  type CoverVertical,
  joinPosition,
  splitPosition,
} from "@/lib/appearance/variants";

const VERTICAL_ICONS: Record<CoverVertical, React.ReactNode> = {
  top: <MdVerticalAlignTop />,
  middle: <MdVerticalAlignCenter />,
  bottom: <MdVerticalAlignBottom />,
};

const HORIZONTAL_ICONS: Record<CoverHorizontal, React.ReactNode> = {
  left: <MdFormatAlignLeft />,
  centre: <MdFormatAlignCenter />,
  right: <MdFormatAlignRight />,
};

// Literal class names, so Tailwind can see them in this file.
const FRAME_ROWS: Record<CoverVertical, string> = {
  top: "justify-start",
  middle: "justify-center",
  bottom: "justify-end",
};

const FRAME_COLS: Record<CoverHorizontal, string> = {
  left: "items-start",
  centre: "items-center",
  right: "items-end",
};

export function PositionPicker({
  value,
  onChange,
}: {
  value: CoverPosition;
  onChange: (position: CoverPosition) => void;
}) {
  const { vertical, horizontal } = splitPosition(value);

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1 space-y-2.5">
        <Row label="Vertical">
          {COVER_VERTICALS.map((option) => (
            <Cell
              key={option.id}
              selected={vertical === option.id}
              onClick={() => onChange(joinPosition(option.id, horizontal))}
              icon={VERTICAL_ICONS[option.id]}
              name={option.name}
              title={option.hint}
            />
          ))}
        </Row>

        <Row label="Horizontal">
          {COVER_HORIZONTALS.map((option) => (
            <Cell
              key={option.id}
              selected={horizontal === option.id}
              onClick={() => onChange(joinPosition(vertical, option.id))}
              icon={HORIZONTAL_ICONS[option.id]}
              name={option.name}
              title={option.hint}
            />
          ))}
        </Row>
      </div>

      <Diagram vertical={vertical} horizontal={horizontal} />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={`${label} position`}>
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-mist">
        {label}
      </p>
      <div className="mt-1.5 grid grid-cols-3 gap-2">{children}</div>
    </div>
  );
}

function Cell({
  selected,
  onClick,
  icon,
  name,
  title,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  name: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={selected}
      className={cx(
        "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 transition-shadow",
        selected ? "bg-claret text-chalk shadow-lg" : "bg-linen shadow-sm",
      )}
    >
      <span aria-hidden className="text-[1.25rem] leading-none">
        {icon}
      </span>
      <span className="text-[0.75rem] font-semibold leading-none">{name}</span>
    </button>
  );
}

function Diagram({
  vertical,
  horizontal,
}: {
  vertical: CoverVertical;
  horizontal: CoverHorizontal;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "inset-shadow-well flex h-[4.75rem] w-14 shrink-0 flex-col gap-1 rounded-lg bg-mist/15 p-2",
        FRAME_ROWS[vertical],
        FRAME_COLS[horizontal],
      )}
    >
      <span className="h-0.5 w-4 rounded-full bg-ash/50" />
      <span className="h-1.5 w-8 rounded-full bg-claret" />
      <span className="h-0.5 w-6 rounded-full bg-ash/50" />
    </span>
  );
}
