import {
  darken,
  lighten,
  mix,
  mutedInk,
  readableInk,
  safeHex,
} from "@/lib/color";
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

export const THEMES: Theme[] = [
  {
    id: "cheese",
    name: "Say Cheese",
    hint: "The house palette. Warm yellow, near-black, one family.",
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
    id: "midnight",
    name: "Midnight",
    hint: "Dark and gold. Made for evening receptions and a phone in a dim room.",
    palette: {
      bg: "#14161F",
      surface: "#1E212D",
      accent: "#E8B44A",
      accentSoft: "#F2CC7A",
      accentDeep: "#C8912A",
      ink: "#F5F2E9",
      muted: "#A7A18F",
      deep: "#DAD4C4",
      hole: "#0A0C12",
    },
  },
  {
    id: "blush",
    name: "Blush",
    hint: "Soft rose and deep plum.",
    palette: {
      bg: "#FBF0F1",
      surface: "#FFFAFA",
      accent: "#E8A0A8",
      accentSoft: "#F3C4C9",
      accentDeep: "#C97A85",
      ink: "#2A1519",
      muted: "#9A5E6A",
      deep: "#6B3742",
      hole: "#3D1F25",
    },
  },
  {
    id: "sage",
    name: "Sage",
    hint: "Muted green and cream. Quiet, and good with greenery.",
    palette: {
      bg: "#F1F3EC",
      surface: "#FBFCF8",
      accent: "#A8BE8F",
      accentSoft: "#C6D6B4",
      accentDeep: "#7E9A66",
      ink: "#1A2016",
      muted: "#586B4A",
      deep: "#3A4A31",
      hole: "#232C1D",
    },
  },
  {
    id: "ink",
    name: "Ink",
    hint: "Black, white and paper. Lets the photographs do everything.",
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

export function buildCustomPalette(input: CustomThemeInput): Palette {
  const base = THEMES[0].palette;
  const bg = safeHex(input.bg, base.bg);
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
  const rawSurface = safeHex(input.surface, lighten(bg, 0.5));
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

export const COVER_VARIANTS = [
  {
    id: "classic",
    name: "Classic",
    hint: "Photo across the top, name over it. The safe one.",
    needsImage: true,
  },
  {
    id: "band",
    name: "Band",
    hint: "Photo above a solid band of colour carrying the name.",
    needsImage: true,
  },
  {
    id: "framed",
    name: "Framed",
    hint: "Photo as a card with a hard shadow, name beside it.",
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
export const DEFAULT_COVER: CoverVariant = "classic";

export function coerceCover(value: unknown): CoverVariant {
  return COVER_VARIANTS.some((v) => v.id === value)
    ? (value as CoverVariant)
    : DEFAULT_COVER;
}

/* -------------------------------------------------------------------------- */

export interface Appearance {
  palette: Palette;
  themeId: string;
  cover: CoverVariant;
  layout: GalleryLayout;
  /** Free events carry the Say Cheese header and footer. */
  platformBranding: boolean;
  /** Whether the host may change any of the above. */
  customisable: boolean;
  /** Free events fix the gallery, so guests get no layout switcher either. */
  allowViewerLayoutChoice: boolean;
}

interface AppearanceSource {
  tier: string;
  theme?: string | null;
  theme_custom?: unknown;
  cover_variant?: string | null;
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
      cover: DEFAULT_COVER,
      layout: DEFAULT_LAYOUT,
      platformBranding: true,
      customisable: false,
      allowViewerLayoutChoice: false,
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
    cover: coerceCover(event.cover_variant),
    layout: coerceLayout(event.gallery_layout),
    platformBranding: false,
    customisable: true,
    allowViewerLayoutChoice: true,
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
