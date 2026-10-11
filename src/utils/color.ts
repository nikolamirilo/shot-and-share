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

export function safeHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = parseHex(value);
  return parsed ? toHex(parsed) : fallback;
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export const AA_CONTRAST = 4.5;
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

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  const h =
    max === rn
      ? 60 * (((gn - bn) / delta) % 6)
      : max === gn
        ? 60 * ((bn - rn) / delta + 2)
        : 60 * ((rn - gn) / delta + 4);

  return { h: (h + 360) % 360, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function tint(color: string, lightness: number): string {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const { h, s } = rgbToHsl(rgb);
  return toHex(
    hslToRgb({ h, s, l: Math.max(0, Math.min(1, lightness)) }),
  );
}

export function darken(color: string, amount: number): string {
  return mix(color, "#000000", amount);
}

export function readableInk(background: string, preferred: string): string {
  if (meetsContrast(preferred, background)) return preferred;

  const bg = parseHex(background);
  if (!bg) return preferred;

  const pushed =
    luminance(bg) > 0.4 ? darken(preferred, 0.75) : lighten(preferred, 0.85);
  if (meetsContrast(pushed, background)) return pushed;

  const white = parseHex("#FFFFFF")!;
  const black = parseHex("#111111")!;
  return contrastRatio(black, bg) >= contrastRatio(white, bg)
    ? "#111111"
    : "#FFFFFF";
}

export function mutedInk(background: string, ink: string): string {
  const candidate = mix(ink, background, 0.42);
  return meetsContrast(candidate, background) ? candidate : ink;
}
