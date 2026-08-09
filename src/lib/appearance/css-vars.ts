import type { Palette } from "@/lib/appearance/themes";

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
