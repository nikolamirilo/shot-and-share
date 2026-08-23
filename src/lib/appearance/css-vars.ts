import type { Palette } from "@/lib/appearance/themes";

/**
 * The palette as CSS custom properties.
 *
 * These are the same variable names the design system defines globally, so
 * setting them on a wrapper re-skins every existing component underneath it
 * without any component knowing themes exist.
 *
 * `--color-scrim` and `--color-scrim-ink` are missing from this list on
 * purpose: the lightbox's dark sheet is the product's, not the event's, and
 * its buttons have to read on it whatever the host has picked. Adding them
 * here would put the black-on-black controls back. See components/ui/scrim.ts.
 */
export function paletteToCssVars(palette: Palette): Record<string, string> {
  return {
    "--color-linen": palette.bg,
    "--color-paper": palette.surface,
    "--color-claret": palette.accent,
    "--color-claret-deep": palette.accentDeep,
    "--color-chalk": palette.onAccent,
    "--color-rose": palette.accentSoft,
    "--color-rose-soft": palette.accentSoft,
    "--color-ink": palette.ink,
    "--color-mist": palette.muted,
    "--color-ash": palette.deep,
    "--color-well": palette.hole,
  };
}
