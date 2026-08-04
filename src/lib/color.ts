/**
 * Colour maths for host-chosen themes.
 *
 * A host picking their own colours is a host who can pick pale grey text on a
 * white background and hand it to two hundred guests in a dark room. So nothing
 * here trusts the input: every derived colour is checked for contrast, and text
 * colours are chosen rather than accepted.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

/** Valid six-digit hex, or the fallback. Used to sanitise anything stored. */
export function safeHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = parseHex(value);
  return parsed ? toHex(parsed) : fallback;
}

/* --- contrast -------------------------------------------------------------- */

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. */
export function luminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** WCAG AA for body text. */
export const AA_CONTRAST = 4.5;
/** WCAG AA for large text and interface components. */
export const AA_LARGE_CONTRAST = 3;

export function meetsContrast(
  foreground: string,
  background: string,
  minimum = AA_CONTRAST,
): boolean {
  const fg = parseHex(foreground);
  const bg = parseHex(background);
  if (!fg || !bg) return false;
  return contrastRatio(fg, bg) >= minimum;
}

export function isDark(color: string): boolean {
  const rgb = parseHex(color);
  return rgb ? luminance(rgb) < 0.35 : false;
}

/* --- derivation ------------------------------------------------------------ */

export function mix(a: string, b: string, weight: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  if (!from || !to) return a;
  const w = Math.max(0, Math.min(1, weight));
  return toHex({
    r: from.r + (to.r - from.r) * w,
    g: from.g + (to.g - from.g) * w,
    b: from.b + (to.b - from.b) * w,
  });
}

export function lighten(color: string, amount: number): string {
  return mix(color, "#FFFFFF", amount);
}

export function darken(color: string, amount: number): string {
  return mix(color, "#000000", amount);
}

/**
 * The text colour to use on a given background.
 *
 * Not "whatever the host picked" — whichever of their ink or its opposite
 * actually reads. A guest squinting at a phone in a dark venue is the whole
 * reason this function exists rather than a comment asking hosts to be careful.
 */
export function readableInk(background: string, preferred: string): string {
  if (meetsContrast(preferred, background)) return preferred;

  const bg = parseHex(background);
  if (!bg) return preferred;

  // Try the preferred ink pushed to its extreme before giving up on it, so a
  // host's dark plum becomes near-black rather than jumping to pure white.
  const pushed =
    luminance(bg) > 0.4 ? darken(preferred, 0.75) : lighten(preferred, 0.85);
  if (meetsContrast(pushed, background)) return pushed;

  /*
   * Last resort: whichever of black or white actually wins, measured rather
   * than guessed from the background's luminance. A mid-grey background is the
   * case that breaks the guess — around #808080 neither pure white nor the
   * "obviously" correct choice reaches 4.5:1, but black does.
   */
  const white = parseHex("#FFFFFF")!;
  const black = parseHex("#111111")!;
  return contrastRatio(black, bg) >= contrastRatio(white, bg)
    ? "#111111"
    : "#FFFFFF";
}

/** A muted version of ink that still reads as text on the same background. */
export function mutedInk(background: string, ink: string): string {
  const candidate = mix(ink, background, 0.42);
  return meetsContrast(candidate, background) ? candidate : ink;
}
