"use client";

import type { CustomColours } from "@/components/dashboard/appearance/settings";
import { Badge } from "@/components/ui";
import { lightBackground } from "@/lib/appearance";
import { AA_CONTRAST, contrastRatio, parseHex } from "@/lib/color";

/**
 * Custom colours, with a live contrast reading.
 *
 * A host cannot be expected to know about WCAG ratios, and their guests will be
 * reading this on a phone in a dark room. The text colour is corrected
 * automatically when it fails - this panel exists so the host is told rather
 * than quietly overridden.
 */
export function CustomColourPicker({
  colors,
  onChange,
}: {
  colors: CustomColours;
  onChange: (next: CustomColours) => void;
}) {
  const fg = parseHex(colors.ink);
  const bg = parseHex(colors.bg);
  const ratio = fg && bg ? contrastRatio(fg, bg) : 0;
  const readable = ratio >= AA_CONTRAST;

  // Event pages are light. A dark pick is lifted rather than refused, and the
  // host is told which colour their guests will actually get - a picker that
  // silently disagrees with the page is worse than one that says no.
  const lifted = lightBackground(colors.bg.toUpperCase());
  const bgWasLifted = lifted !== colors.bg.toUpperCase();

  const fields: Array<[keyof CustomColours, string]> = [
    ["bg", "Background"],
    ["surface", "Cards"],
    ["accent", "Accent"],
    ["ink", "Text"],
  ];

  return (
    <div className="inset-shadow-well rounded-xl bg-pepper/5 p-4">
      <div className="grid grid-cols-2 gap-3 @min-[30rem]:grid-cols-4">
        {fields.map(([key, label]) => (
          <label key={key} className="block">
            <span className="block text-[0.8125rem] font-semibold">{label}</span>
            <span className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                value={colors[key]}
                onChange={(e) =>
                  onChange({ ...colors, [key]: e.target.value.toUpperCase() })
                }
                className="h-12 w-12 shrink-0 cursor-pointer rounded-lg bg-transparent p-0 shadow-md"
                aria-label={label}
              />
              <span className="font-mono text-[0.6875rem] uppercase tracking-wider">
                {colors[key]}
              </span>
            </span>
          </label>
        ))}
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.8125rem]">
        <Badge tone={readable ? "gouda" : "outline"}>
          contrast {ratio.toFixed(1)}:1
        </Badge>
        <span className="text-crust">
          {readable
            ? "Comfortable to read on a phone."
            : "Too low to read comfortably. We will darken or lighten your text colour automatically - pick a stronger one to keep the shade you want."}
        </span>
      </p>

      {bgWasLifted && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.8125rem]">
          <span
            className="inset-shadow-well h-5 w-5 shrink-0 rounded-full shadow-sm"
            style={{ background: lifted }}
          />
          <span className="text-crust">
            Event pages are always light, so guests get{" "}
            <span className="font-mono uppercase">{lifted}</span> as the
            background - the palest version of the colour you picked.
          </span>
        </p>
      )}
    </div>
  );
}
