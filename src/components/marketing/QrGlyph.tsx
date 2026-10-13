import { QR_MARGIN, QR_PLATE_RADIUS, qrCells } from "@/utils/qr-plan";

/**
 * The card's code: a decorative pattern, drawn exactly like the code generated
 * for a real event (rounded modules, nested finders, quiet zone).
 */
const PATTERN = [
  "1111111011010001111111",
  "1000001001100101000001",
  "1011101011010101011101",
  "1011101000111001011101",
  "1011101011001101011101",
  "1000001001011001000001",
  "1111111010101011111111",
  "0000000011100000000000",
  "1101101101011011011011",
  "0010010110100100100100",
  "1101011010110110101101",
  "0110100101001011010010",
  "1011011010110100101101",
  "0100100101001011010010",
  "1101101011010110110101",
  "0000000010110100101100",
  "1111111011010110110101",
  "1000001001001011010010",
  "1011101011010110110101",
  "1011101000101001011010",
  "1011101011011010110101",
  "1111111001001011010010",
];

const PLATE = "#FFFFFF";
const MODULES = "#181214";

const { extent, cells } = qrCells(
  PATTERN.length,
  (row, col) => PATTERN[row][col] === "1",
);

/** The quiet zone's share of the drawing, for anything that tracks the modules. */
export const QR_GLYPH_QUIET = `${((QR_MARGIN / extent) * 100).toFixed(2)}%`;

export function QrGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${extent} ${extent}`} className={className} aria-hidden>
      <rect width={extent} height={extent} rx={QR_PLATE_RADIUS} fill={PLATE} />
      {cells.map((c) => (
        <rect
          key={`${c.x}-${c.y}-${c.size}`}
          x={c.x}
          y={c.y}
          width={c.size}
          height={c.size}
          rx={c.radius}
          fill={c.dark ? MODULES : PLATE}
        />
      ))}
    </svg>
  );
}
