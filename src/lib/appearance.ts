import {
  darken,
  lighten,
  mix,
  mutedInk,
  readableInk,
  safeHex,
  tint,
} from "@/lib/color";
import type { FontSet } from "@/lib/fonts";
import { DEFAULT_FONT_ID, coerceFont, findFontSet } from "@/lib/fonts";
import type { GalleryLayout } from "@/lib/gallery";
import { DEFAULT_LAYOUT, coerceLayout } from "@/lib/gallery";
import { getTier } from "@/lib/tiers";

/**
 * The look of a guest's event page.
 *
 * Everything here is a paid feature - it is the "custom event page" the Slice
 * and Wheel plans already promise. A free event gets the product's own theme,
 * a fixed cover, a fixed gallery, and a small Say Cheese header and footer,
 * which is what makes the free plan a genuinely useful product that also sells
 * the next one.
 *
 * The gate is applied when the appearance is *read*, not only when it is
 * written. Enforcing it on write alone would mean a stale row, a replayed
 * request, or any future path that skips the form quietly serves paid styling.
 */

export interface Palette {
  /** Page background. */
  bg: string;
  /** Cards and panels sitting on the background. */
  surface: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  /** Text, borders, buttons. */
  ink: string;
  /** Secondary text. */
  muted: string;
  /** Body copy that is not quite ink. */
  deep: string;
  /** The inside of every punched circle. */
  hole: string;
}

export interface Theme {
  id: string;
  name: string;
  hint: string;
  palette: Palette;
}

/**
 * Every preset is light, and that is a rule rather than a coincidence.
 *
 * An event page is looked at twice: on a phone held up at the party, and on a
 * laptop the next morning. A dark page wins the first and loses the second, and
 * it fights every photograph on it - a wedding is white dresses and daylight,
 * a birthday is a lit cake, and both sit in a dark frame like a mistake. Light
 * pages also print, screenshot and paste into a group chat without surprises.
 *
 * The six are the palettes events are actually held in: the house yellow for
 * anything loud, ivory and gold, dusty rose, sage, dusty blue, and paper. A
 * host who wants something else has the custom picker - which is held to the
 * same rule, see buildCustomPalette.
 */
export const THEMES: Theme[] = [
  {
    id: "cheese",
    name: "Say Cheese",
    hint: "The house palette. Warm yellow and near-black - birthdays, parties, anything loud.",
    palette: {
      bg: "#FFF6DC",
      surface: "#FFFDF4",
      accent: "#FFC02E",
      accentSoft: "#FFD666",
      accentDeep: "#F0A000",
      ink: "#1F1607",
      muted: "#B0670F",
      deep: "#7A4409",
      hole: "#4A3110",
    },
  },
  {
    id: "ivory",
    name: "Ivory",
    hint: "Ivory and antique gold. The wedding palette, and the one that suits almost anything.",
    palette: {
      bg: "#FAF6EC",
      surface: "#FFFFFF",
      accent: "#C6A15B",
      accentSoft: "#DFC694",
      accentDeep: "#9E7F41",
      ink: "#241F16",
      muted: "#7C6A46",
      deep: "#4C4231",
      hole: "#2C261A",
    },
  },
  {
    id: "blush",
    name: "Blush",
    hint: "Dusty rose and plum. Engagements, showers, spring weddings.",
    palette: {
      bg: "#FBF1EF",
      surface: "#FFFAF9",
      accent: "#DFA69E",
      accentSoft: "#EFC9C3",
      accentDeep: "#B87A72",
      ink: "#2A1917",
      muted: "#96605A",
      deep: "#66403B",
      hole: "#3B2320",
    },
  },
  {
    id: "sage",
    name: "Sage",
    hint: "Sage green and cream. Quiet, and good with greenery.",
    palette: {
      bg: "#F0F4EA",
      surface: "#FBFCF7",
      accent: "#A5BD8B",
      accentSoft: "#C8D9B5",
      accentDeep: "#7B9761",
      ink: "#1D2318",
      muted: "#566A48",
      deep: "#3A4A31",
      hole: "#232C1D",
    },
  },
  {
    id: "sky",
    name: "Sky",
    hint: "Dusty blue and slate. Christenings, milestone birthdays, anything formal.",
    palette: {
      bg: "#EEF3F8",
      surface: "#FBFDFF",
      accent: "#9FBDD8",
      accentSoft: "#C6DAEA",
      accentDeep: "#6B90B1",
      ink: "#16202B",
      muted: "#4E6A80",
      deep: "#33475A",
      hole: "#1D2B37",
    },
  },
  {
    id: "ink",
    name: "Ink",
    hint: "Paper and charcoal. Lets the photographs do everything.",
    palette: {
      bg: "#F4F2EE",
      surface: "#FFFFFF",
      accent: "#DCD6CA",
      accentSoft: "#EDE9E1",
      accentDeep: "#B5AE9F",
      ink: "#16150F",
      muted: "#6A665B",
      deep: "#3A372E",
      hole: "#201E17",
    },
  },
];

export const DEFAULT_THEME_ID = "cheese";
export const CUSTOM_THEME_ID = "custom";

export function findTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/* -------------------------------------------------------------------------- */

/**
 * A host picks four colours. The other five are derived, and the text colours
 * are corrected for contrast rather than taken on trust - see readableInk.
 */
export interface CustomThemeInput {
  bg?: string;
  surface?: string;
  accent?: string;
  ink?: string;
}

/**
 * The lightest the page and its cards are allowed to be dark.
 *
 * Perceived brightness rather than WCAG luminance: this is a question about
 * what the page *looks* like, not about whether text on it can be read, and
 * relativeBrightness is the same measure the surface nudge below already uses.
 */
const LIGHT_FLOOR = 0.82;

/**
 * The host's colour, lifted into the light range if it was not already there.
 *
 * Event pages are light - see the note above THEMES - and the custom picker is
 * not a hole in that rule. A host who types black gets the palest version of
 * their own colour rather than a dark page, and the picker tells them so
 * instead of quietly disagreeing with the swatch they chose.
 *
 * It tints rather than mixing towards white, because a host who picked forest
 * green should recognise what comes back. Mixing drains the hue on the way up
 * and hands back a grey; a tint keeps the hue and moves the lightness. The mix
 * afterwards is only the remainder, for a hue so dark that even a pale version
 * of it is not pale enough - and being a straight line through brightness, the
 * weight that lands exactly on the floor can be solved for rather than stepped.
 */
export function lightBackground(hex: string): string {
  if (relativeBrightness(hex) >= LIGHT_FLOOR) return hex;

  const tinted = tint(hex, 0.92);
  const lifted = relativeBrightness(tinted);
  return lifted >= LIGHT_FLOOR
    ? tinted
    : lighten(tinted, (LIGHT_FLOOR - lifted) / (1 - lifted));
}

export function buildCustomPalette(input: CustomThemeInput): Palette {
  const base = THEMES[0].palette;
  const bg = lightBackground(safeHex(input.bg, base.bg));
  const accent = safeHex(input.accent, base.accent);
  const requestedInk = safeHex(input.ink, base.ink);

  /*
   * A surface that vanishes into the background makes every card disappear, so
   * it is nudged away rather than accepted as given.
   *
   * The direction matters: a surface normally lifts *off* the background, but
   * when the background is already white there is nowhere lighter to go, and
   * lightening it does nothing at all.
   */
  const rawSurface = lightBackground(safeHex(input.surface, lighten(bg, 0.5)));
  const surface =
    Math.abs(relativeBrightness(rawSurface) - relativeBrightness(bg)) < 0.03
      ? relativeBrightness(bg) >= 0.92
        ? darken(rawSurface, 0.06)
        : lighten(rawSurface, 0.14)
      : rawSurface;

  const ink = readableInk(bg, requestedInk);

  return {
    bg,
    surface,
    accent,
    accentSoft: lighten(accent, 0.28),
    accentDeep: darken(accent, 0.2),
    ink,
    muted: mutedInk(bg, ink),
    deep: mix(ink, bg, 0.22),
    hole: darken(ink, 0.35),
  };
}

function relativeBrightness(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

/* -------------------------------------------------------------------------- */

/**
 * How the page opens.
 *
 * Four shapes became three plus a default, because two of the four were the
 * same decision. "Framed" - a photo card with the name beside it - stacked into
 * a small picture above a heading on the phone every guest actually holds,
 * which is "Band" without the colour; it is gone, and the events that had it
 * now open full screen.
 *
 * What is left differs in what the guest sees first, which is the only question
 * a cover answers: the whole photograph, a photograph with the ask under it,
 * or no photograph at all.
 */
export const COVER_VARIANTS = [
  {
    id: "full",
    name: "Full screen",
    hint: "The photo fills the phone, name across the bottom. The one that makes a guest stop.",
    needsImage: true,
  },
  {
    id: "classic",
    name: "Banner",
    hint: "Photo across the top, name over it. Guests reach the upload button without scrolling.",
    needsImage: true,
  },
  {
    id: "band",
    name: "Band",
    hint: "Photo above a solid band of colour carrying the name. Best when the photo is busy.",
    needsImage: true,
  },
  {
    id: "type",
    name: "Just type",
    hint: "No photo at all. Large type on the theme colour.",
    needsImage: false,
  },
] as const;

export type CoverVariant = (typeof COVER_VARIANTS)[number]["id"];
export const DEFAULT_COVER: CoverVariant = "full";

export function coerceCover(value: unknown): CoverVariant {
  return COVER_VARIANTS.some((v) => v.id === value)
    ? (value as CoverVariant)
    : DEFAULT_COVER;
}

/* -------------------------------------------------------------------------- */

/**
 * How the guest is asked for their photos.
 *
 * This is the one component on the page that has a job to do, so the variants
 * differ in shape and prominence rather than in decoration. Every one of them
 * keeps the same three things: one obvious action, the optional name field, and
 * the line saying what may be sent.
 */
export const UPLOAD_VARIANTS = [
  {
    id: "button",
    name: "Big button",
    hint: "One wide button on a card. Impossible to miss, and the safe one.",
  },
  {
    id: "panel",
    name: "Drop panel",
    hint: "A large dashed panel. Tap it on a phone, or drop files on it from a laptop.",
  },
  {
    id: "bar",
    name: "Slim bar",
    hint: "A compact row. Takes little height, so the gallery starts higher up.",
  },
  {
    id: "split",
    name: "Camera or library",
    hint: "Two buttons: take one now, or pick from the camera roll.",
  },
] as const;

export type UploadVariant = (typeof UPLOAD_VARIANTS)[number]["id"];
export const DEFAULT_UPLOAD: UploadVariant = "button";

export function coerceUpload(value: unknown): UploadVariant {
  return UPLOAD_VARIANTS.some((v) => v.id === value)
    ? (value as UploadVariant)
    : DEFAULT_UPLOAD;
}

/* -------------------------------------------------------------------------- */

export interface Appearance {
  palette: Palette;
  themeId: string;
  font: FontSet;
  cover: CoverVariant;
  upload: UploadVariant;
  layout: GalleryLayout;
  /** Free events carry the Say Cheese header and footer. */
  platformBranding: boolean;
  /** Whether the host may change any of the above. */
  customisable: boolean;
}

interface AppearanceSource {
  tier: string;
  theme?: string | null;
  theme_custom?: unknown;
  theme_font?: string | null;
  cover_variant?: string | null;
  upload_variant?: string | null;
  gallery_layout?: string | null;
}

/**
 * The single source of truth for how an event page looks.
 *
 * Called by the guest page, the host preview and anything else that renders an
 * event. A free event gets the defaults here regardless of what is in its row,
 * which means a downgrade, a stale value or a hand-crafted request cannot buy
 * paid styling.
 */
export function resolveAppearance(event: AppearanceSource): Appearance {
  const tier = getTier(event.tier);

  if (!tier.customPage) {
    return {
      palette: THEMES[0].palette,
      themeId: DEFAULT_THEME_ID,
      font: findFontSet(DEFAULT_FONT_ID),
      cover: DEFAULT_COVER,
      upload: DEFAULT_UPLOAD,
      layout: DEFAULT_LAYOUT,
      platformBranding: true,
      customisable: false,
    };
  }

  const themeId = event.theme ?? DEFAULT_THEME_ID;
  const palette =
    themeId === CUSTOM_THEME_ID
      ? buildCustomPalette((event.theme_custom ?? {}) as CustomThemeInput)
      : findTheme(themeId).palette;

  return {
    palette,
    themeId,
    font: findFontSet(coerceFont(event.theme_font)),
    cover: coerceCover(event.cover_variant),
    upload: coerceUpload(event.upload_variant),
    layout: coerceLayout(event.gallery_layout),
    platformBranding: false,
    customisable: true,
  };
}

/**
 * The palette as CSS custom properties.
 *
 * These are the same variable names the design system defines globally, so
 * setting them on a wrapper re-skins every existing component underneath it
 * without any component knowing themes exist.
 */
export function paletteToCssVars(palette: Palette): Record<string, string> {
  return {
    "--color-butter": palette.bg,
    "--color-cream": palette.surface,
    "--color-gouda": palette.accent,
    "--color-gouda-light": palette.accentSoft,
    "--color-gouda-deep": palette.accentDeep,
    "--color-pepper": palette.ink,
    "--color-rind": palette.muted,
    "--color-crust": palette.deep,
    "--color-hole": palette.hole,
  };
}
