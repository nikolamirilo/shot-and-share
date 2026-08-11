import QRCode from "qrcode";

/**
 * QR codes are generated server-side as SVG, which prints at any size without
 * pixelation. The code is the actual product - it is the thing that goes on the
 * table - so it gets the same care as the screen does.
 */

/**
 * The dark modules only, so the code can be composed into the printable card.
 *
 * `qrcode` emits them as a single *stroked* path with half-pixel offsets, not
 * as filled rectangles - so it has to be drawn back with `stroke` and a width
 * of one module, and `shape-rendering="crispEdges"` to stop a printer driver
 * anti-aliasing the edges into something a scanner struggles with.
 */
export async function qrSvgPath(url: string): Promise<{
  path: string;
  size: number;
}> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
  });

  const path = /<path[^>]*stroke="[^"]*"[^>]*\sd="([^"]+)"/.exec(svg)?.[1] ?? "";
  if (!path) {
    throw new Error("Could not read the QR path out of the generated SVG.");
  }
  const size = Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1] ?? 25);
  return { path, size };
}

/**
 * The design tokens, written out. The card is generated on a server and printed
 * on somebody else's printer, so it cannot read a stylesheet - these are the
 * same values as `globals.css` and have to be changed in both places.
 */
const INK = "#181214";
const PAPER = "#ffffff";
const CHALK = "#fdf6f7";
const ASH = "#6c5f62";
const CLARET = "#7a1230";
const CLARET_DEEP = "#5c0b23";
const ROSE_SOFT = "#e6b9c4";

const DISPLAY = "Archivo, ui-sans-serif, system-ui, sans-serif";
const SANS = "Instrument Sans, ui-sans-serif, system-ui, sans-serif";
const MONO = "Azeret Mono, ui-monospace, SFMono-Regular, monospace";

/** Plain ink-on-white. Scanners are happiest and it survives a cheap printer. */
export async function qrSvg(url: string, pixels = 512): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: pixels,
    color: { dark: INK, light: PAPER },
  });
}

export interface CardOptions {
  eventName: string;
  /** Wedding tier: the printable card carries the event branding. */
  branded: boolean;
  headline?: string;
}

/**
 * The print-ready card. A5 at 300dpi is 1748 x 2480; we draw in points and let
 * the SVG scale, since vector output means the printer decides the resolution.
 *
 * There is no link printed on it. A typed share token is a long string of
 * random characters that nobody gets right from a table across a dark room, and
 * the line asking them to try was the one thing on the card competing with the
 * code. The code is the way in.
 *
 * The branded card is the palette's one loud move: claret ground, chalk type.
 * The plain one is the same card on white. Either way the code itself sits on
 * its own near-white plate, because a scanner wants contrast, not styling.
 */
export async function qrCardSvg(
  url: string,
  opts: CardOptions,
): Promise<string> {
  const { path, size } = await qrSvgPath(url);
  const W = 600;
  const H = 850;

  const qrBox = 320;
  const qrX = (W - qrBox) / 2;
  const qrY = 300;
  const scale = qrBox / size;

  const headline = escapeXml(opts.headline ?? "Share your photos");
  const name = escapeXml(opts.eventName);

  const ground = opts.branded ? CLARET : PAPER;
  const frame = opts.branded ? CHALK : INK;
  const heading = opts.branded ? CHALK : INK;
  const quiet = opts.branded ? ROSE_SOFT : ASH;
  const eyebrow = opts.branded ? ROSE_SOFT : CLARET;

  const holes = opts.branded
    ? `
    <circle cx="76" cy="96" r="26" fill="${CLARET_DEEP}" />
    <circle cx="524" cy="150" r="16" fill="${CLARET_DEEP}" />
    <circle cx="60" cy="770" r="18" fill="${CLARET_DEEP}" />
    <circle cx="536" cy="742" r="30" fill="${CLARET_DEEP}" />`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Scan to share your photos">
  <rect width="${W}" height="${H}" fill="${ground}" />
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="${frame}" stroke-width="4" rx="28" />
  ${holes}
  <text x="${W / 2}" y="150" text-anchor="middle" font-family="${MONO}" font-size="18" letter-spacing="3.2" fill="${eyebrow}">SAY CHEESE</text>
  <text x="${W / 2}" y="216" text-anchor="middle" font-family="${DISPLAY}" font-size="46" font-weight="800" fill="${heading}">${headline}</text>
  <text x="${W / 2}" y="258" text-anchor="middle" font-family="${SANS}" font-size="22" fill="${quiet}">${name}</text>

  <rect x="${qrX - 20}" y="${qrY - 20}" width="${qrBox + 40}" height="${qrBox + 40}" fill="${CHALK}" stroke="${frame}" stroke-width="4" rx="20" />
  <g transform="translate(${qrX} ${qrY}) scale(${scale})" shape-rendering="crispEdges">
    <path d="${path}" stroke="${INK}" stroke-width="1" fill="none" />
  </g>

  <text x="${W / 2}" y="${qrY + qrBox + 100}" text-anchor="middle" font-family="${SANS}" font-size="24" font-weight="600" fill="${heading}">Point your camera at the code</text>
  <text x="${W / 2}" y="${H - 48}" text-anchor="middle" font-family="${SANS}" font-size="17" fill="${quiet}">No app. No account. Just photos.</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
