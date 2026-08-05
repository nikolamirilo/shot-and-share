import { describe, expect, it } from "vitest";

import {
  COVER_VARIANTS,
  CUSTOM_THEME_ID,
  DEFAULT_COVER,
  DEFAULT_THEME_ID,
  DEFAULT_UPLOAD,
  THEMES,
  UPLOAD_VARIANTS,
  buildCustomPalette,
  coerceCover,
  coerceUpload,
  findTheme,
  paletteToCssVars,
  resolveAppearance,
} from "@/lib/appearance";
import {
  DEFAULT_FONT_ID,
  FONT_SETS,
  coerceFont,
  findFontSet,
  fontToCssVars,
  googleFontsHref,
} from "@/lib/fonts";
import {
  AA_CONTRAST,
  AA_LARGE_CONTRAST,
  contrastRatio,
  darken,
  isDark,
  lighten,
  meetsContrast,
  mix,
  parseHex,
  readableInk,
  safeHex,
  toHex,
} from "@/lib/color";

describe("colour parsing", () => {
  it("handles both shorthand and full hex", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("1F1607")).toEqual({ r: 31, g: 22, b: 7 });
  });

  it("rejects anything that is not a colour", () => {
    // These arrive from a form and end up in an inline style attribute.
    expect(parseHex("red")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("javascript:alert(1)")).toBeNull();
    expect(parseHex("")).toBeNull();
  });

  it("falls back rather than passing junk through to CSS", () => {
    expect(safeHex("nonsense", "#FFC02E")).toBe("#FFC02E");
    expect(safeHex(null, "#FFC02E")).toBe("#FFC02E");
    expect(safeHex("#abc", "#FFC02E")).toBe("#AABBCC");
  });

  it("round-trips", () => {
    expect(toHex(parseHex("#FFC02E")!)).toBe("#FFC02E");
  });
});

describe("contrast", () => {
  it("matches the WCAG extremes", () => {
    expect(contrastRatio(parseHex("#000")!, parseHex("#fff")!)).toBeCloseTo(21, 1);
    expect(contrastRatio(parseHex("#fff")!, parseHex("#fff")!)).toBeCloseTo(1, 5);
  });

  it("passes the house palette", () => {
    // If the product's own theme failed this, the thresholds would be wrong.
    expect(meetsContrast("#1F1607", "#FFF6DC")).toBe(true);
  });

  it("identifies dark backgrounds", () => {
    expect(isDark("#14161F")).toBe(true);
    expect(isDark("#FFF6DC")).toBe(false);
  });
});

describe("readable ink", () => {
  it("keeps the host's colour when it already reads", () => {
    expect(readableInk("#FFF6DC", "#1F1607")).toBe("#1F1607");
  });

  it("rescues an unreadable choice", () => {
    // Pale grey text on white is the thing a host will absolutely try, and
    // their guests are reading it on a phone in a dark room.
    const rescued = readableInk("#FFFFFF", "#EEEEEE");
    expect(meetsContrast(rescued, "#FFFFFF")).toBe(true);
  });

  it("pushes the chosen hue to its extreme before abandoning it", () => {
    // A host's dark plum should become near-black, not jump to pure white.
    const rescued = readableInk("#FFFFFF", "#B07A85");
    expect(meetsContrast(rescued, "#FFFFFF")).toBe(true);
    expect(rescued).not.toBe("#FFFFFF");
  });

  it("goes light on a dark background", () => {
    const rescued = readableInk("#14161F", "#1A1A1A");
    expect(meetsContrast(rescued, "#14161F")).toBe(true);
  });

  it("always lands somewhere readable, whatever it is given", () => {
    for (const bg of ["#000000", "#FFFFFF", "#808080", "#FFC02E", "#14161F"]) {
      for (const ink of ["#808080", "#FFFFFF", "#000000", "#7F7F7F"]) {
        expect(meetsContrast(readableInk(bg, ink), bg)).toBe(true);
      }
    }
  });
});

describe("colour derivation", () => {
  it("mixes towards the target", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mix("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mix("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
  });

  it("clamps a weight outside the range instead of overflowing", () => {
    expect(mix("#000000", "#FFFFFF", 5)).toBe("#FFFFFF");
    expect(mix("#000000", "#FFFFFF", -5)).toBe("#000000");
  });

  it("lightens and darkens", () => {
    expect(lighten("#808080", 0.5)).toBe("#C0C0C0");
    expect(darken("#808080", 0.5)).toBe("#404040");
  });
});

describe("built themes", () => {
  it("every preset is readable", () => {
    for (const theme of THEMES) {
      const { ink, bg, surface, muted } = theme.palette;
      expect(meetsContrast(ink, bg), `${theme.id} ink on bg`).toBe(true);
      expect(meetsContrast(ink, surface), `${theme.id} ink on surface`).toBe(true);
      expect(
        meetsContrast(muted, bg, AA_LARGE_CONTRAST),
        `${theme.id} muted on bg`,
      ).toBe(true);
    }
  });

  it("falls back to the house theme for an unknown id", () => {
    expect(findTheme("nope").id).toBe(DEFAULT_THEME_ID);
    expect(findTheme(null).id).toBe(DEFAULT_THEME_ID);
  });

  it("builds a readable palette from any custom input", () => {
    const palette = buildCustomPalette({
      bg: "#FFFFFF",
      surface: "#FFFFFF",
      accent: "#00AAFF",
      ink: "#F0F0F0",
    });
    expect(contrastRatio(parseHex(palette.ink)!, parseHex(palette.bg)!))
      .toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("keeps cards from vanishing into the background", () => {
    // A surface identical to the page makes every card disappear.
    const palette = buildCustomPalette({ bg: "#FFFFFF", surface: "#FFFFFF" });
    expect(palette.surface).not.toBe(palette.bg);
  });

  it("ignores junk instead of writing it into a style attribute", () => {
    const palette = buildCustomPalette({
      bg: "url(javascript:alert(1))",
      accent: "'; --x:",
    } as never);
    for (const value of Object.values(palette)) {
      expect(value).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe("plan gating", () => {
  const customised = {
    theme: "midnight",
    theme_custom: { bg: "#000000" },
    theme_font: "loud",
    cover_variant: "framed",
    upload_variant: "panel",
    gallery_layout: "masonry",
  };

  it("gives a free event the house theme whatever its row says", () => {
    // The gate is applied on read. A stale row, a downgrade, or any future
    // path that skips the form must not serve paid styling.
    const appearance = resolveAppearance({ tier: "free", ...customised });
    expect(appearance.themeId).toBe(DEFAULT_THEME_ID);
    expect(appearance.palette).toEqual(THEMES[0].palette);
    expect(appearance.font.id).toBe(DEFAULT_FONT_ID);
    expect(appearance.cover).toBe(DEFAULT_COVER);
    expect(appearance.upload).toBe(DEFAULT_UPLOAD);
    expect(appearance.layout).toBe("grid");
    expect(appearance.customisable).toBe(false);
  });

  it("puts the platform header and footer only on free events", () => {
    expect(resolveAppearance({ tier: "free" }).platformBranding).toBe(true);
    expect(resolveAppearance({ tier: "event" }).platformBranding).toBe(false);
    expect(resolveAppearance({ tier: "wedding" }).platformBranding).toBe(false);
  });

  it("fixes the gallery on free, so guests get no switcher either", () => {
    expect(resolveAppearance({ tier: "free" }).allowViewerLayoutChoice).toBe(
      false,
    );
    expect(resolveAppearance({ tier: "event" }).allowViewerLayoutChoice).toBe(
      true,
    );
  });

  it("honours everything on a paid event", () => {
    const appearance = resolveAppearance({ tier: "wedding", ...customised });
    expect(appearance.themeId).toBe("midnight");
    expect(appearance.font.id).toBe("loud");
    expect(appearance.cover).toBe("framed");
    expect(appearance.upload).toBe("panel");
    expect(appearance.layout).toBe("masonry");
    expect(appearance.customisable).toBe(true);
  });

  it("builds the custom palette for a paid event", () => {
    const appearance = resolveAppearance({
      tier: "event",
      theme: CUSTOM_THEME_ID,
      theme_custom: { bg: "#101010", accent: "#22DD88", ink: "#FFFFFF" },
    });
    expect(appearance.palette.bg).toBe("#101010");
    expect(meetsContrast(appearance.palette.ink, appearance.palette.bg)).toBe(
      true,
    );
  });
});

describe("cover variants", () => {
  it("coerces anything unknown to the default", () => {
    expect(coerceCover("framed")).toBe("framed");
    expect(coerceCover("carousel")).toBe(DEFAULT_COVER);
    expect(coerceCover(undefined)).toBe(DEFAULT_COVER);
  });

  it("has exactly one variant that works without a photo", () => {
    // Everything else falls back to it before a cover photo is chosen, so
    // there has to be one and only one.
    const noImage = COVER_VARIANTS.filter((v) => !v.needsImage);
    expect(noImage).toHaveLength(1);
    expect(noImage[0].id).toBe("type");
  });
});

describe("upload variants", () => {
  it("coerces anything unknown to the default", () => {
    expect(coerceUpload("panel")).toBe("panel");
    expect(coerceUpload("carousel")).toBe(DEFAULT_UPLOAD);
    expect(coerceUpload(null)).toBe(DEFAULT_UPLOAD);
  });

  it("matches the ids the database constraint allows", () => {
    // 0006 constrains this column, so a new variant needs a migration as well
    // as a component. Drifting apart means a save that fails at the database.
    expect(UPLOAD_VARIANTS.map((v) => v.id)).toEqual([
      "button",
      "panel",
      "bar",
      "split",
    ]);
  });
});

describe("type pairings", () => {
  it("falls back to the house pairing rather than rejecting", () => {
    // `theme_font` is unconstrained in the database on purpose: a removed
    // pairing has to degrade, not break the page.
    expect(coerceFont("warm")).toBe("warm");
    expect(coerceFont("papyrus")).toBe(DEFAULT_FONT_ID);
    expect(findFontSet("papyrus").id).toBe(DEFAULT_FONT_ID);
  });

  it("only asks the browser for a pairing the root layout lacks", () => {
    // The house pairing is already loaded for every page; a guest on hotel
    // wifi should not fetch it twice.
    expect(googleFontsHref(findFontSet(DEFAULT_FONT_ID))).toBeNull();

    const href = googleFontsHref(findFontSet("classic"));
    expect(href).toContain("family=Playfair+Display");
    expect(href).toContain("display=swap");
  });

  it("carries the display settings the stylesheet cannot assume", () => {
    // 86% width is right for Bricolage, which has a width axis, and wrong for
    // a serif that does not - so weight, width and tracking travel with the
    // face rather than living in globals.css.
    for (const set of FONT_SETS) {
      const vars = fontToCssVars(set);
      expect(vars["--font-display"]).toBe(set.display);
      expect(vars["--font-sans"]).toBe(set.body);
      expect(vars["--font-display-weight"]).toBe(String(set.displayWeight));
      expect(vars["--font-display-stretch"]).toMatch(/%$/);
      expect(vars["--font-display-tracking"]).toMatch(/em$/);
    }
  });
});

describe("css variables", () => {
  it("maps onto the names the design system already uses", () => {
    // This is what lets a theme re-skin every existing component without any
    // component knowing themes exist.
    const vars = paletteToCssVars(THEMES[0].palette);
    expect(vars["--color-butter"]).toBe("#FFF6DC");
    expect(vars["--color-pepper"]).toBe("#1F1607");
    expect(vars["--color-gouda"]).toBe("#FFC02E");
    expect(Object.keys(vars)).toHaveLength(9);
  });
});
