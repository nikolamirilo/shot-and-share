import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ON_SCRIM, ON_SCRIM_FLOATING } from "@/components/ui/scrim";
import { BUTTON_FILL } from "@/components/ui/button";
import { THEMES, buildCustomPalette, paletteToCssVars } from "@/lib/appearance";
import { AA_CONTRAST, contrastRatio, parseHex } from "@/lib/color";

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
  it("are defined as literal hex, not as another token", () => {
    const { bg, ink } = scrimPair();
    expect(bg).toBeTruthy();
    expect(ink).toBeTruthy();
  });

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

  it("is the case worth guarding: some themes make chalk and ink the same", () => {
    // Not a defect in the palettes - `onAccent` is allowed to equal `ink` when
    // the accent is pale. It is only a defect when something on the dark scrim
    // uses the two together, which is what the classes below are checked for.
    const collisions = THEMES.filter(
      (t) => t.palette.onAccent.toUpperCase() === t.palette.ink.toUpperCase(),
    );
    expect(collisions.length).toBeGreaterThan(0);
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
    expectUnthemed("ON_SCRIM_FLOATING", ON_SCRIM_FLOATING);
    expectUnthemed("the onDark button fill", BUTTON_FILL.onDark);
  });

  it("are the only thing the lightbox paints them with", () => {
    // Close, Download, Report and the two arrows: every fill in the file has
    // to come from the shared pair rather than be spelled out again.
    const source = read("src/components/gallery/lightbox.tsx");
    expect(source).not.toMatch(/bg-chalk|bg-paper|bg-linen(?!\/)/);
    expect(source).toContain("ON_SCRIM");

    const report = read("src/components/gallery/report-button.tsx");
    expect(report).not.toMatch(/bg-chalk/);
    expect(report).toContain("ON_SCRIM");
  });

  it("sit on a scrim that is dark under every theme", () => {
    // The sheet itself is `bg-ink/92`, and the light pair only reads on it
    // while `ink` stays dark. It does, by construction: a custom ink is put
    // through `readableInk` against a background that is forced light.
    const white = parseHex("#FFFFFF")!;
    for (const palette of THEMES.map((t) => t.palette)) {
      expect(contrastRatio(parseHex(palette.ink)!, white)).toBeGreaterThanOrEqual(
        AA_CONTRAST,
      );
    }
  });
});
