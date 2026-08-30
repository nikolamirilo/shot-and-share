import { describe, expect, it } from "vitest";

import {
  COVER_VARIANTS,
  CUSTOM_THEME_ID,
  DEFAULT_COVER,
  DEFAULT_POSITION,
  DEFAULT_THEME_ID,
  DEFAULT_UPLOAD,
  THEMES,
  buildCustomPalette,
  coerceCover,
  coercePosition,
  coerceUpload,
  findTheme,
  lightBackground,
  resolveAppearance,
} from "@/lib/appearance";
import {
  DEFAULT_FONT_ID,
  coerceFont,
  findFontSet,
  googleFontsHref,
} from "@/lib/fonts";
import {
  AA_CONTRAST,
  AA_LARGE_CONTRAST,
  contrastRatio,
  isDark,
  lighten,
  meetsContrast,
  mix,
  parseHex,
  readableInk,
  rgbToHsl,
  tint,
} from "@/lib/color";
import {
  fromEvent,
  toFields,
} from "@/components/dashboard/appearance/settings";
import type { EventRow } from "@/lib/db/types";
import { TIERS } from "@/lib/tiers";

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
});

describe("contrast", () => {
  it("matches the WCAG extremes", () => {
    expect(contrastRatio(parseHex("#000")!, parseHex("#fff")!)).toBeCloseTo(21, 1);
    expect(contrastRatio(parseHex("#fff")!, parseHex("#fff")!)).toBeCloseTo(1, 5);
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

  it("pushes the chosen hue to its extreme before abandoning it", () => {
    // A host's dark plum should become near-black, not jump to pure white.
    const rescued = readableInk("#FFFFFF", "#B07A85");
    expect(meetsContrast(rescued, "#FFFFFF")).toBe(true);
    expect(rescued).not.toBe("#FFFFFF");
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

  it("tints without draining the hue", () => {
    // Mixing towards white hands back a grey with a hint of the colour in it;
    // a tint hands back the same colour, paler. Lifting a dark custom
    // background depends entirely on the difference.
    const tinted = parseHex(tint("#0B3D2E", 0.92))!;
    const mixed = parseHex(lighten("#0B3D2E", 0.9))!;
    expect(tinted.g - tinted.r).toBeGreaterThan(mixed.g - mixed.r);
    expect(rgbToHsl(tinted).l).toBeCloseTo(0.92, 2);
  });

  it("leaves a grey grey", () => {
    expect(tint("#808080", 0.9)).toBe("#E6E6E6");
  });
});

describe("built themes", () => {
  it("has no dark preset, and no way to reach one", () => {
    /*
     * The rule, not a description of today's list: an event page is looked at
     * on a phone at the party and on a laptop the next morning, and a dark
     * page fights every photograph on it. Adding a dark preset should fail
     * here rather than ship.
     */
    for (const theme of THEMES) {
      expect(isDark(theme.palette.bg), `${theme.id} background`).toBe(false);
      expect(isDark(theme.palette.surface), `${theme.id} cards`).toBe(false);
    }
  });

  it("lifts a dark custom background into the light", () => {
    // The custom picker is not a hole in the rule above. A host who types
    // black gets the palest version of it, and the form says so.
    for (const bg of ["#000000", "#101820", "#2A5F3A", "#4B2E83"]) {
      const palette = buildCustomPalette({ bg });
      expect(isDark(palette.bg), bg).toBe(false);
      expect(isDark(palette.surface), `${bg} cards`).toBe(false);
      // Still legible on it, whatever the lift did.
      expect(meetsContrast(palette.ink, palette.bg)).toBe(true);
    }
  });

  it("leaves a background that is already light exactly as it was", () => {
    expect(lightBackground("#FFF6DC")).toBe("#FFF6DC");
    expect(buildCustomPalette({ bg: "#FBF1EF" }).bg).toBe("#FBF1EF");
  });

  it("keeps the hue when it lifts", () => {
    // Lifting must not turn every dark pick into the same grey: a host who
    // chose forest green should get the palest green, not the palest anything.
    const lifted = parseHex(lightBackground("#0B3D2E"))!;
    expect(lifted.g).toBeGreaterThan(lifted.r);
    expect(lifted.g).toBeGreaterThan(lifted.b);
  });

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

describe("where the name sits", () => {
  it("falls back to the cover every event already has", () => {
    // A row written before this column existed, a value from a future option
    // set, or a hand-made request: all three land on the position that has
    // always been there rather than moving somebody's page.
    expect(DEFAULT_POSITION).toBe("bottom-left");
    expect(coercePosition(undefined)).toBe(DEFAULT_POSITION);
    expect(coercePosition("bottom")).toBe(DEFAULT_POSITION);
    expect(coercePosition("top-right")).toBe(DEFAULT_POSITION);
    expect(coercePosition({ id: "centre" })).toBe(DEFAULT_POSITION);
  });
});

describe("plan gating", () => {
  const customised = {
    theme: "sage",
    theme_custom: { bg: "#000000" },
    theme_font: "loud",
    cover_variant: "half",
    cover_position: "top-left",
    upload_variant: "panel",
    gallery_layout: "masonry",
  };

  it("gives a free event the house theme whatever its row says", () => {
    // The gate is applied on read. A stale row, a downgrade, or any future
    // path that skips the form must not serve paid styling.
    const appearance = resolveAppearance({ tier: TIERS.free.id, ...customised });
    expect(appearance.themeId).toBe(DEFAULT_THEME_ID);
    expect(appearance.palette).toEqual(THEMES[0].palette);
    expect(appearance.font.id).toBe(DEFAULT_FONT_ID);
    expect(appearance.cover).toBe(DEFAULT_COVER);
    expect(appearance.coverPosition).toBe(DEFAULT_POSITION);
    expect(appearance.upload).toBe(DEFAULT_UPLOAD);
    expect(appearance.layout).toBe("grid");
    expect(appearance.customisable).toBe(false);
  });

  it("puts the platform header and footer only on free events", () => {
    expect(resolveAppearance({ tier: TIERS.free.id }).platformBranding).toBe(true);
    expect(resolveAppearance({ tier: TIERS.plus.id }).platformBranding).toBe(false);
    expect(resolveAppearance({ tier: TIERS.pro.id }).platformBranding).toBe(false);
  });

  it("honours everything on a paid event", () => {
    const appearance = resolveAppearance({ tier: TIERS.pro.id, ...customised });
    expect(appearance.themeId).toBe("sage");
    expect(appearance.font.id).toBe("loud");
    expect(appearance.cover).toBe("half");
    expect(appearance.coverPosition).toBe("top-left");
    expect(appearance.upload).toBe("panel");
    expect(appearance.layout).toBe("masonry");
    expect(appearance.customisable).toBe(true);
  });

  it("builds the custom palette for a paid event", () => {
    const appearance = resolveAppearance({
      tier: TIERS.plus.id,
      theme: CUSTOM_THEME_ID,
      theme_custom: { bg: "#2A5F3A", accent: "#22DD88", ink: "#101010" },
    });
    // The hue survives; the darkness does not - see "every page is light".
    expect(appearance.palette.bg).not.toBe("#2A5F3A");
    expect(meetsContrast(appearance.palette.ink, appearance.palette.bg)).toBe(
      true,
    );
  });
});

describe("cover variants", () => {
  it("coerces anything unknown to the default", () => {
    expect(coerceCover("half")).toBe("half");
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
});

/**
 * The panel's own copy of the settings: what a row turns into and what the save
 * sends back.
 *
 * The position is the newest field in both, and a field missed in either one is
 * a setting that previews perfectly and never reaches the database.
 */
describe("the host's draft of the event page", () => {
  const row = {
    id: "e1",
    theme: "sage",
    theme_font: "loud",
    theme_custom: {},
    cover_variant: "full",
    cover_position: "centre",
    upload_variant: "panel",
    gallery_layout: "masonry",
    cover_media_id: null,
  } as unknown as EventRow;

  it("reads the position off the row", () => {
    expect(fromEvent(row).coverPosition).toBe("centre");
    expect(
      fromEvent({ ...row, cover_position: "sideways" } as EventRow)
        .coverPosition,
    ).toBe(DEFAULT_POSITION);
  });

  it("sends the position to the server on save", () => {
    const settings = { ...fromEvent(row), coverPosition: "top-left" } as const;
    expect(toFields(settings).cover_position).toBe("top-left");
  });
});
