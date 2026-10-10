import QRCode from "qrcode";

import type { Palette } from "@/lib/appearance/themes";
import { contrastRatio, parseHex } from "@/lib/color";

/**
 * QR codes, drawn server-side as SVG. One plan, so the code the host looks at
 * on the dashboard is the artwork their PNG is rasterised from.
 */

/**
 * Quartile, not medium. The modules are drawn as separated rounded shapes
 * rather than a solid grid, which costs some ink coverage, and a code on a
 * table in a dim room has no margin to spare.
 */
const ECC = "Q";

/** The gap around each module, as a fraction of it. */
const INSET = 0.06;

/** How round a data module is. Half would be a dot; this is a soft square. */
const RADIUS = 0.3;

/** The fallback module colour, where the theme's own ink is too pale to scan. */
const INK = "#181214";

interface Cell {
  x: number;
  y: number;
  size: number;
  radius: number;
  /** False for the light square inside a finder ring. */
  dark: boolean;
}

/**
 * The code as shapes, in module units, quiet zone included.
 *
 * The three corner squares are the finder patterns - what a scanner looks for
 * first - drawn as one rounded ring with a rounded pupil rather than as 33
 * separate modules.
 */
function codePlan(
  url: string,
  margin: number,
): { extent: number; cells: Cell[] } {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: ECC });
  const n = modules.size;
  const cells: Cell[] = [];

  const finders = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
  const inFinder = (row: number, col: number) =>
    finders.some(
      ([fr, fc]) => row >= fr && row < fr + 7 && col >= fc && col < fc + 7,
    );

  for (const [fr, fc] of finders) {
    cells.push(
      { x: fc + margin, y: fr + margin, size: 7, radius: 2, dark: true },
      { x: fc + margin + 1, y: fr + margin + 1, size: 5, radius: 1.4, dark: false },
      { x: fc + margin + 2, y: fr + margin + 2, size: 3, radius: 0.9, dark: true },
    );
  }

  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (!modules.data[row * n + col] || inFinder(row, col)) continue;
      cells.push({
        x: col + margin + INSET,
        y: row + margin + INSET,
        size: 1 - INSET * 2,
        radius: RADIUS,
        dark: true,
      });
    }
  }

  return { extent: n + margin * 2, cells };
}

export interface CodeColours {
  /** The ground the code sits on. Never transparent - a code needs its white. */
  plate: string;
  /** The modules themselves. */
  modules: string;
}

/**
 * The code's two colours, from the event's theme, so what the host prints
 * matches the page guests land on.
 *
 * The theme only gets its way if its two colours are far enough apart. A
 * scanner wants contrast, not styling.
 */
export function codeColours(palette: Palette): CodeColours {
  const plate = palette.surface;
  return {
    plate,
    modules: readable(palette.ink, plate) ? palette.ink : INK,
  };
}

/** Enough separation to point a camera at. */
function readable(colour: string, on: string): boolean {
  const a = parseHex(colour);
  const b = parseHex(on);
  return a !== null && b !== null && contrastRatio(a, b) >= 4.5;
}

/**
 * The code on its own, as SVG: what the dashboard shows and what the host's
 * PNG is rasterised from. Four modules of quiet zone, per the spec.
 */
export function qrSvg(
  url: string,
  { plate, modules, pixels = 512 }: CodeColours & { pixels?: number },
): string {
  const { extent, cells } = codePlan(url, 4);
  const shapes = cells
    .map(
      (c) =>
        `<rect x="${round(c.x)}" y="${round(c.y)}" width="${round(c.size)}" height="${round(c.size)}" rx="${round(c.radius)}" fill="${c.dark ? modules : plate}" />`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}" width="${pixels}" height="${pixels}" role="img" aria-label="QR code for this event"><rect width="${extent}" height="${extent}" rx="2" fill="${plate}" />${shapes}</svg>`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
