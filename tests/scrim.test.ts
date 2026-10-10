import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  GLASS,
  GLASS_DENSE,
  GLASS_QUIET,
  ON_SCRIM,
} from "@/components/ui/scrim";
import { BUTTON_FILL } from "@/components/ui/button";
import { THEMES, buildCustomPalette, paletteToCssVars } from "@/lib/appearance";
import { AA_CONTRAST, type Rgb, contrastRatio, parseHex } from "@/lib/color";

/**
 * The lightbox lays a dark sheet over the event page, and its controls have to
 * be visible on every theme a host can pick.
 *
 * They were not. They were painted `bg-chalk text-ink`, and `chalk` is the
 * theme's "what reads on the accent" - which for a pale accent is a near-black.
 * Blush ships the same near-black for both, so Close, Download and the two
 * arrows were dark brown shapes with dark brown labels on them: invisible.
 *
 * These tests hold every part of the fix in place at once.
 */

const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

/** The literal pair, read back out of the stylesheet that defines it. */
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
    // The bug in one line: a theme that could set these would be back to
    // painting the lightbox in its own colours.
    const palettes = [
      ...THEMES.map((t) => t.palette),
      // The custom picker, including the shape that caused this: one pale
      // colour used for both the accent and the ink.
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
  /** Tokens whose value the event theme rewrites. */
  const THEMED = [
    "chalk",
    "linen",
    "paper",
    "claret",
    "rose",
    "well",
    "mist",
    "ash",
    /* `ink` on its own, not `scrim-ink`. */
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
    // The dock, the counter, Close, Report and the two arrows: every fill in
    // the file has to come from the shared material rather than be spelled out
    // again.
    const source = read("src/components/gallery/lightbox.tsx");
    expect(source).not.toMatch(/bg-chalk|bg-paper|bg-linen(?!\/)/);
    expect(source).toContain(`GLASS`);

    const report = read("src/components/gallery/report-button.tsx");
    expect(report).not.toMatch(/bg-chalk|bg-linen|bg-blush/);
    expect(report).toContain(`GLASS`);
  });
});

/**
 * The glass is white and see-through, and the type on it is dark. That is a
 * decision about contrast rather than about taste: a pale panel stays pale over
 * a photograph of a night sky *and* over a photograph of a white dress, so the
 * label reads on both. Light type on clear glass does not - it goes the moment
 * somebody photographs something bright, which is most of a wedding.
 *
 * So the test is the two extremes: whatever ends up behind the glass, the
 * worst it can composite to still has to clear AA against the scrim's ink.
 */
describe("the glass", () => {
  /** The `.glass` rule, read back out of the stylesheet that defines it. */
  function glassRule() {
    const css = read("src/app/globals.css");
    const start = css.indexOf("  .glass {");
    expect(start, "globals.css has no .glass rule").toBeGreaterThan(-1);
    return css.slice(start, css.indexOf("}", start));
  }

  /** The fill laid over a background, the way a browser composites it. */
  function over(backdrop: Rgb, fill: Rgb, alpha: number): Rgb {
    const blend = (f: number, b: number) => f * alpha + b * (1 - alpha);
    return {
      r: blend(fill.r, backdrop.r),
      g: blend(fill.g, backdrop.g),
      b: blend(fill.b, backdrop.b),
    };
  }

  it("is the class the components ask for by name", () => {
    // The constant and the stylesheet are two halves of one thing: a rename on
    // either side leaves every control in the lightbox unpainted.
    expect(read("src/app/globals.css")).toContain(`.${GLASS} {`);
  });

  it("is the scrim's pair, which no theme can reach", () => {
    const rule = glassRule();
    expect(rule).toContain("var(--color-scrim)");
    expect(rule).toContain("var(--color-scrim-ink)");
    // The themed tokens, including `--color-ink`, which is the one a host's
    // own palette would otherwise slip in here.
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
    // Softened ink is only offered on the thickened glass, so that is the
    // backdrop it has to clear - over the darkest photograph and the brightest.
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
    // Without backdrop-filter a translucent panel is just a washed-out one.
    const css = read("src/app/globals.css");
    expect(css).toMatch(/@supports not \(\s*\n?\s*\(backdrop-filter/);
  });
});
