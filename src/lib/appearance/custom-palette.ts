import {
  darken,
  lighten,
  mix,
  mutedInk,
  readableInk,
  safeHex,
  tint,
} from "@/utils/color";
import { type Palette, THEMES } from "@/lib/appearance/themes";

export interface CustomThemeInput {
  bg?: string;
  surface?: string;
  accent?: string;
  ink?: string;
}

const LIGHT_FLOOR = 0.82;

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
