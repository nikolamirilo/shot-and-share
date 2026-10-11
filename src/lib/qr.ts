import QRCode from "qrcode";

import type { Palette } from "@/lib/appearance/themes";
import { contrastRatio, parseHex } from "@/utils/color";

/**
 * Quartile, not medium: the modules are drawn as separated rounded shapes, which costs
 * some readability.
 */
const ECC = "Q";

const INSET = 0.06;

const RADIUS = 0.3;

const INK = "#181214";

interface Cell {
  x: number;
  y: number;
  size: number;
  radius: number;
  dark: boolean;
}

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
  plate: string;
  modules: string;
}

export function codeColours(palette: Palette): CodeColours {
  const plate = palette.surface;
  return {
    plate,
    modules: readable(palette.ink, plate) ? palette.ink : INK,
  };
}

function readable(colour: string, on: string): boolean {
  const a = parseHex(colour);
  const b = parseHex(on);
  return a !== null && b !== null && contrastRatio(a, b) >= 4.5;
}

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
