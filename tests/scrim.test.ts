import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  GLASS,
  GLASS_DENSE,
  GLASS_QUIET,
  ON_SCRIM,
} from "@/components/ui/scrim";
import { BUTTON_FILL } from "@/components/ui/Button";
import { THEMES, buildCustomPalette, paletteToCssVars } from "@/lib/appearance";
import { AA_CONTRAST, type Rgb, contrastRatio, parseHex } from "@/utils/color";

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

function scrimPair() {
  const css = read("src/app/globals.css");
  const bg = /--color-scrim:\s*(#[0-9a-fA-F]{3,8})/.exec(css)?.[1];
  const ink = /--color-scrim-ink:\s*(#[0-9a-fA-F]{3,8})/.exec(css)?.[1];
  return { bg, ink };
}

describe("the scrim's colours", () => {
  it("read against each other", () => {
    const { bg, ink } = scrimPair();
    expect(contrastRatio(parseHex(bg!)!, parseHex(ink!)!)).toBeGreaterThanOrEqual(
      AA_CONTRAST,
    );
  });

  it("are never handed to a theme", () => {
    const palettes = [
      ...THEMES.map((t) => t.palette),
      buildCustomPalette({
        bg: "#FFFFFF",
        surface: "#FFFDF4",
        accent: "#F4CDE0",
        ink: "#F4CDE0",
      }),
      buildCustomPalette({ bg: "#000000", accent: "#FFFFFF", ink: "#FFFFFF" }),
    ];

    for (const palette of palettes) {
      const keys = Object.keys(paletteToCssVars(palette));
      expect(keys.filter((k) => k.startsWith("--color-scrim"))).toEqual([]);
    }
  });
});

describe("controls on the scrim", () => {
  const THEMED = [
    "chalk",
    "linen",
    "paper",
    "claret",
    "rose",
    "well",
    "mist",
    "ash",
    // `ink` on its own, not `scrim-ink`.
    "-ink\\b(?!-)",
  ];

  function expectUnthemed(label: string, classes: string) {
    for (const token of THEMED) {
      const pattern = new RegExp(`(bg|text|border|ring)-${token}`);
      expect(
        pattern.test(classes),
        `${label} uses a themed colour: ${classes}`,
      ).toBe(false);
    }
    expect(classes).toContain("bg-scrim");
    expect(classes).toContain("text-scrim-ink");
  }

  it("carry the scrim's own pair", () => {
    expectUnthemed("ON_SCRIM", ON_SCRIM);
    expectUnthemed("the onDark button fill", BUTTON_FILL.onDark);
  });

  it("are the only thing the lightbox paints them with", () => {
    const source = read("src/components/gallery/Lightbox.tsx");
    expect(source).not.toMatch(/bg-chalk|bg-paper|bg-linen(?!\/)/);
    expect(source).toContain(`GLASS`);

    const report = read("src/components/gallery/ReportButton.tsx");
    expect(report).not.toMatch(/bg-chalk|bg-linen|bg-blush/);
    expect(report).toContain(`GLASS`);
  });
});

describe("the glass", () => {
  function glassRule() {
    const css = read("src/app/globals.css");
    const start = css.indexOf("  .glass {");
    expect(start, "globals.css has no .glass rule").toBeGreaterThan(-1);
    return css.slice(start, css.indexOf("}", start));
  }

  function over(backdrop: Rgb, fill: Rgb, alpha: number): Rgb {
    const blend = (f: number, b: number) => f * alpha + b * (1 - alpha);
    return {
      r: blend(fill.r, backdrop.r),
      g: blend(fill.g, backdrop.g),
      b: blend(fill.b, backdrop.b),
    };
  }

  it("is the class the components ask for by name", () => {
    expect(read("src/app/globals.css")).toContain(`.${GLASS} {`);
  });

  it("is the scrim's pair, which no theme can reach", () => {
    const rule = glassRule();
    expect(rule).toContain("var(--color-scrim)");
    expect(rule).toContain("var(--color-scrim-ink)");
    expect(rule).not.toMatch(
      /var\(--color-(ink|chalk|linen|paper|blush|claret|rose|ash|mist|well)\)/,
    );
  });

  it("reads over the darkest photograph and the brightest one", () => {
    const rule = glassRule();
    const alpha = Number(
      /--color-scrim\)\s*(\d+)%/.exec(rule)?.[1] ?? "0",
    ) / 100;
    expect(alpha).toBeGreaterThan(0);

    const { bg, ink } = scrimPair();
    const fill = parseHex(bg!)!;
    const type = parseHex(ink!)!;

    for (const [name, backdrop] of [
      ["a night shot", { r: 0, g: 0, b: 0 }],
      ["a white dress", { r: 255, g: 255, b: 255 }],
    ] as const) {
      const panel = over(backdrop, fill, alpha);
      expect(
        contrastRatio(panel, type),
        `the glass over ${name}`,
      ).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });

  it("keeps its quiet register readable on the panel that offers it", () => {
    const fill = parseHex(scrimPair().bg!)!;
    const type = parseHex(scrimPair().ink!)!;
    const panelAlpha = Number(/bg-scrim\/(\d+)/.exec(GLASS_DENSE)?.[1]) / 100;
    const inkAlpha = Number(/text-scrim-ink\/(\d+)/.exec(GLASS_QUIET)?.[1]) / 100;

    for (const backdrop of [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ]) {
      const panel = over(backdrop, fill, panelAlpha);
      expect(
        contrastRatio(panel, over(panel, type, inkAlpha)),
      ).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });

  it("stops being see-through where there is nothing to blur", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/@supports not \(\s*\n?\s*\(backdrop-filter/);
  });
});
