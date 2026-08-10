import {
  darken,
  lighten,
  mix,
  mutedInk,
  readableInk,
  safeHex,
  tint,
} from "@/lib/color";
import { type Palette, THEMES } from "@/lib/appearance/themes";

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
    /* Buttons are filled with the accent now, so the label on them cannot be
       assumed: a host who picks near-black and a host who picks pale gold both
       get whichever of their ink or its opposite actually reads. */
    onAccent: readableInk(accent, ink),
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
