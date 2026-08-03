import QRCode from "qrcode";

/**
 * QR codes are generated server-side as SVG, which prints at any size without
 * pixelation. The code is the actual product — it is the thing that goes on the
 * table — so it gets the same care as the screen does.
 */

/**
 * The dark modules only, so the code can be composed into the printable card.
 *
 * `qrcode` emits them as a single *stroked* path with half-pixel offsets, not
 * as filled rectangles — so it has to be drawn back with `stroke` and a width
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

/** Plain black-on-white. Scanners are happiest and it survives a cheap printer. */
export async function qrSvg(url: string, pixels = 512): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: pixels,
    color: { dark: "#1F1607", light: "#FFFDF4" },
  });
}

export interface CardOptions {
  eventName: string;
  /** Shown under the code so a guest can type it if the camera fails. */
  shortUrl: string;
  /** Wedding tier: the printable card carries the event branding. */
  branded: boolean;
  headline?: string;
}

/**
 * The print-ready card. A5 at 300dpi is 1748 x 2480; we draw in points and let
 * the SVG scale, since vector output means the printer decides the resolution.
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
  const short = escapeXml(opts.shortUrl.replace(/^https?:\/\//, ""));

  const holes = opts.branded
    ? `
    <circle cx="76" cy="96" r="26" fill="#4A3110" />
    <circle cx="524" cy="150" r="16" fill="#4A3110" />
    <circle cx="60" cy="770" r="18" fill="#4A3110" />
    <circle cx="536" cy="742" r="30" fill="#4A3110" />`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Scan to share your photos">
  <rect width="${W}" height="${H}" fill="${opts.branded ? "#FFC02E" : "#FFFDF4"}" />
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="#1F1607" stroke-width="4" rx="28" />
  ${holes}
  <text x="${W / 2}" y="150" text-anchor="middle" font-family="DM Mono, ui-monospace, monospace" font-size="18" letter-spacing="3.2" fill="#B0670F">SAY CHEESE</text>
  <text x="${W / 2}" y="216" text-anchor="middle" font-family="Bricolage Grotesque, Georgia, serif" font-size="46" font-weight="800" fill="#1F1607">${headline}</text>
  <text x="${W / 2}" y="258" text-anchor="middle" font-family="Figtree, Helvetica, sans-serif" font-size="22" fill="#7A4409">${name}</text>

  <rect x="${qrX - 20}" y="${qrY - 20}" width="${qrBox + 40}" height="${qrBox + 40}" fill="#FFFDF4" stroke="#1F1607" stroke-width="4" rx="20" />
  <g transform="translate(${qrX} ${qrY}) scale(${scale})" shape-rendering="crispEdges">
    <path d="${path}" stroke="#1F1607" stroke-width="1" fill="none" />
  </g>

  <text x="${W / 2}" y="${qrY + qrBox + 92}" text-anchor="middle" font-family="Figtree, Helvetica, sans-serif" font-size="24" font-weight="600" fill="#1F1607">Point your camera at the code</text>
  <text x="${W / 2}" y="${qrY + qrBox + 130}" text-anchor="middle" font-family="DM Mono, ui-monospace, monospace" font-size="19" letter-spacing="1.2" fill="#7A4409">${short}</text>
  <text x="${W / 2}" y="${H - 48}" text-anchor="middle" font-family="Figtree, Helvetica, sans-serif" font-size="17" fill="#B0670F">No app. No account. Just photos.</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
