import { describe, expect, it } from "vitest";

import { THEMES, findTheme } from "@/lib/appearance/themes";
import { contrastRatio, parseHex } from "@/lib/color";
import { codeColours, qrSvg } from "@/lib/qr";

const URL_UNDER_TEST = "https://shotandshare.com/e/aVeryLongTokenValue123456";
const HOUSE = findTheme("cheese").palette;

describe("QR generation", () => {
  it("gives the code its quiet zone", async () => {
    // Four modules of white on every side. Without them a scanner has nothing
    // to find the symbol's edge against.
    const svg = qrSvg(URL_UNDER_TEST, codeColours(HOUSE));
    const extent = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]);
    const first = Number(/<rect x="([\d.]+)"/.exec(svg)![1]);
    expect(first).toBe(4);
    expect(extent).toBeGreaterThan(4 * 2 + 20);
  });

  it("keeps the code readable whatever the theme is", async () => {
    // The code has a job besides looking like the event: a scanner wants
    // contrast, so a palette too pale to point a camera at is overruled.
    for (const theme of THEMES) {
      const { plate, modules } = codeColours(theme.palette);
      expect(contrastRatio(parseHex(modules)!, parseHex(plate)!)).toBeGreaterThan(7);
    }
  });

  it("draws the code on a plate rather than on nothing", async () => {
    // A transparent ground is a code that cannot be scanned off a dark table.
    const svg = qrSvg(URL_UNDER_TEST, codeColours(HOUSE));
    const { plate, modules } = codeColours(HOUSE);
    expect(svg).toContain(`fill="${plate}"`);
    expect(svg).toContain(`fill="${modules}"`);
  });
});
