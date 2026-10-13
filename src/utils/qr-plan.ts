/**
 * The geometry of a Shot & Share code: modules as separated rounded squares and
 * the three finders as nested rounded squares. Shared so the marketing glyph and
 * the code generated for an event are the same drawing.
 */

export interface QrCell {
  x: number;
  y: number;
  size: number;
  radius: number;
  dark: boolean;
}

/** Modules sit inside their cell so they read as dots rather than a grid. */
const INSET = 0.06;

const RADIUS = 0.3;

/** The quiet zone a scanner wants, in modules. */
export const QR_MARGIN = 4;

export const QR_PLATE_RADIUS = 2;

export function qrCells(
  size: number,
  dark: (row: number, col: number) => boolean,
  margin: number = QR_MARGIN,
): { extent: number; cells: QrCell[] } {
  const cells: QrCell[] = [];

  const finders = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
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

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!dark(row, col) || inFinder(row, col)) continue;
      cells.push({
        x: col + margin + INSET,
        y: row + margin + INSET,
        size: 1 - INSET * 2,
        radius: RADIUS,
        dark: true,
      });
    }
  }

  return { extent: size + margin * 2, cells };
}
