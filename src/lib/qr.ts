import QRCode from "qrcode";

import type { Palette } from "@/lib/appearance/themes";
import { contrastRatio, parseHex } from "@/utils/color";
import {
  QR_MARGIN,
  QR_PLATE_RADIUS,
  qrCells,
  type QrCell,
} from "@/utils/qr-plan";

/**
 * Quartile, not medium: the modules are drawn as separated rounded shapes, which costs
 * some readability.
 */
const ECC = "Q";

const INK = "#181214";

function codePlan(
  url: string,
  margin: number,
): { extent: number; cells: QrCell[] } {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: ECC });
  const n = modules.size;
  return qrCells(n, (row, col) => !!modules.data[row * n + col], margin);
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
  const { extent, cells } = codePlan(url, QR_MARGIN);
  const shapes = cells
    .map(
      (c) =>
        `<rect x="${round(c.x)}" y="${round(c.y)}" width="${round(c.size)}" height="${round(c.size)}" rx="${round(c.radius)}" fill="${c.dark ? modules : plate}" />`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}" width="${pixels}" height="${pixels}" role="img" aria-label="QR code for this event"><rect width="${extent}" height="${extent}" rx="${QR_PLATE_RADIUS}" fill="${plate}" />${shapes}</svg>`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
