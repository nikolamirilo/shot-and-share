import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

import type { Palette } from "@/lib/appearance/themes";
import { contrastRatio, mix, parseHex } from "@/lib/color";

/**
 * QR codes, drawn server-side: an SVG for the host's dashboard and an A5 PDF
 * for the printed card. Both come from one plan, so what a host looks at on
 * screen is the artwork that gets printed.
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

/* -------------------------------------------------------------------------- */

/**
 * The card cannot read a stylesheet, so these repeat `globals.css` and have to
 * be changed in both places.
 */
const INK = "#181214";
const PAPER = "#ffffff";

export interface CardColours extends CodeColours {
  /** The card's field. */
  ground: string;
  /** The border, and the edge of the plate the code sits on. */
  frame: string;
  /** Headline and instruction. */
  heading: string;
  /** Event name and footer. */
  quiet: string;
  /** The wordmark. */
  eyebrow: string;
  /** The hairline field behind the card, or nothing on a plain card. */
  texture: string | null;
}

/**
 * The card in the host's own colours. `onAccent` is contrast-corrected where
 * the palette is built, so a claret card sets in chalk and a pale gold one in
 * ink without either being special-cased here.
 *
 * The code is the exception: it takes the palette's surface and ink, and only
 * if those two are far enough apart. A scanner wants contrast, not styling.
 */
export function cardColours(palette: Palette, branded: boolean): CardColours {
  const plate = palette.surface;
  const modules = readable(palette.ink, plate) ? palette.ink : INK;

  if (!branded) {
    return {
      ground: palette.surface,
      frame: palette.ink,
      heading: palette.ink,
      quiet: palette.deep,
      eyebrow: readable(palette.accent, palette.surface)
        ? palette.accent
        : palette.ink,
      texture: null,
      plate,
      modules,
    };
  }

  const soft = mix(palette.onAccent, palette.accent, 0.28);
  return {
    ground: palette.accent,
    frame: palette.onAccent,
    heading: palette.onAccent,
    quiet: soft,
    eyebrow: soft,
    texture: palette.accentDeep,
    plate,
    modules,
  };
}

/** Enough separation to set text on, or to point a camera at. */
function readable(colour: string, on: string): boolean {
  const a = parseHex(colour);
  const b = parseHex(on);
  return a !== null && b !== null && contrastRatio(a, b) >= 4.5;
}

export interface CardOptions {
  eventName: string;
  /** The card's eyebrow, already formatted for reading. */
  eventDate?: string;
  colours: CardColours;
}

/** A5 in points. Setting the page box means print gives 148 x 210mm exactly. */
const PAGE_W = 419.53;
const PAGE_H = 595.28;

/**
 * The layout is written in the card's own 600 x 850 grid and scaled onto the
 * page, so the numbers below read as a design rather than as millimetres. The
 * two aspect ratios agree to within half a percent.
 */
const W = 600;
const H = 850;
const K = PAGE_W / W;

/**
 * The print-ready card.
 *
 * The event's name is the largest thing on it and the only large line, so one
 * card works for a wedding, a fortieth and a company summer party unchanged.
 *
 * No link is printed: a typed share token is a long random string nobody gets
 * right from across a dark room, and the line asking them to try was the one
 * thing competing with the code.
 *
 * Set in the PDF standard faces rather than the product's own - shipping three
 * variable webfonts to set four lines of text is not a trade worth making.
 */
export async function qrCardPdf(
  url: string,
  opts: CardOptions,
): Promise<Uint8Array> {
  const { colours } = opts;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${opts.eventName} - share your photos`);
  pdf.setCreator("Shot & Share");
  pdf.setProducer("Shot & Share");

  const display = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const page = pdf.addPage([PAGE_W, PAGE_H]);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
    color: hex(colours.ground),
  });

  roundedRect(page, {
    x: 18,
    y: 18,
    width: W - 36,
    height: H - 36,
    radius: 28,
    borderColor: hex(colours.frame),
    borderWidth: 4,
  });

  // The Wedding-tier flourish: an even field of fine diagonal hairlines, a step
  // darker than the ground. It reads as the card's stock rather than as a motif,
  // so it belongs to whatever the event is instead of to a product's own shape.
  if (colours.texture) {
    drawTexture(page, colours.texture);
  }

  // The date rather than a second instruction: the one under the code already
  // says it, and saying it twice reads as a card that does not trust you.
  const date = printable(opts.eventDate ?? "").toUpperCase();
  if (date) {
    tracked(page, date, {
      font: mono,
      size: 15,
      tracking: 2.6,
      baseline: 150,
      color: hex(colours.eyebrow),
    });
  }

  drawName(page, printable(opts.eventName), {
    font: display,
    colour: hex(colours.heading),
  });

  const qrBox = 320;
  const qrX = (W - qrBox) / 2;
  const qrY = 300;

  roundedRect(page, {
    x: qrX - 20,
    y: qrY - 20,
    width: qrBox + 40,
    height: qrBox + 40,
    radius: 20,
    color: hex(colours.plate),
    borderColor: hex(colours.frame),
    borderWidth: 4,
  });
  drawCode(page, url, { x: qrX, y: qrY, box: qrBox, colours });

  centred(page, "Point your camera at the code", {
    font: display,
    size: 24,
    baseline: qrY + qrBox + 106,
    color: hex(colours.heading),
  });
  tracked(page, "SHOT & SHARE", {
    font: mono,
    size: 14,
    tracking: 3,
    baseline: H - 44,
    color: hex(colours.eyebrow),
  });

  return pdf.save();
}

/**
 * The event's name, as large as the card can carry it.
 *
 * A name is whatever a host typed - "Ana & Marko" or "Marija i Nikola -
 * vjenčanje 2026" - so the size is solved for rather than picked: one line as
 * big as fits, and two balanced lines when even the smallest would overflow.
 */
function drawName(
  page: PDFPage,
  name: string,
  { font, colour }: { font: PDFFont; colour: ReturnType<typeof rgb> },
) {
  if (!name) return;
  const room = 456;

  const single = largestSize(font, [name], room, 52, 30);
  if (single) {
    centred(page, name, { font, size: single, baseline: 234, color: colour });
    return;
  }

  const [top, bottom] = balance(name);
  const size = largestSize(font, [top, bottom], room, 38, 15) ?? 15;
  centred(page, top, { font, size, baseline: 206, color: colour });
  centred(page, bottom, {
    font,
    size,
    baseline: 206 + Math.round(size * 1.2),
    color: colour,
  });
}

/** The biggest whole point size in the range at which every line still fits. */
function largestSize(
  font: PDFFont,
  lines: string[],
  room: number,
  from: number,
  to: number,
): number | null {
  for (let size = from; size >= to; size -= 1) {
    // Widths scale linearly, so measuring at a size in card units returns a
    // width in card units - no need to convert to points and back.
    if (lines.every((line) => font.widthOfTextAtSize(line, size) <= room)) {
      return size;
    }
  }
  return null;
}

/** Two lines of roughly equal length, split on the most even word boundary. */
function balance(name: string): [string, string] {
  const words = name.split(" ");
  if (words.length < 2) return [name, ""];

  let best = 1;
  let closest = Infinity;
  for (let at = 1; at < words.length; at += 1) {
    const left = words.slice(0, at).join(" ").length;
    const right = words.slice(at).join(" ").length;
    if (Math.abs(left - right) < closest) {
      closest = Math.abs(left - right);
      best = at;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/**
 * The same shapes the SVG draws, onto the page. Two modules of quiet zone
 * rather than four: the plate adds another two of the same near-white on every
 * side, so the code still gets its four.
 */
function drawCode(
  page: PDFPage,
  url: string,
  {
    x,
    y,
    box,
    colours,
  }: { x: number; y: number; box: number; colours: CardColours },
) {
  const { extent, cells } = codePlan(url, 2);
  const unit = (box / extent) * K;
  const left = x * K;
  const top = PAGE_H - y * K;

  // Every data module is the same shape, so its path is built once and only its
  // position moves. The finders are three sizes and get their own.
  const paths = new Map<string, string>();
  for (const cell of cells) {
    const key = `${cell.size}:${cell.radius}`;
    let path = paths.get(key);
    if (!path) {
      path = roundedPath(cell.size * unit, cell.size * unit, cell.radius * unit);
      paths.set(key, path);
    }
    page.drawSvgPath(path, {
      x: left + cell.x * unit,
      y: top - cell.y * unit,
      color: hex(cell.dark ? colours.modules : colours.plate),
    });
  }
}

/** How far apart the hairlines run, and how wide each one is, in card units. */
const TEXTURE_PITCH = 26;
const TEXTURE_WIDTH = 1;

/** The margin the field keeps off the frame, so no line crosses the border. */
const TEXTURE_INSET = 30;

/**
 * The hairline field: parallel lines at 45 degrees across the card, drawn as
 * filled shapes rather than strokes so they sit in the same paint as everything
 * else on the page.
 *
 * Everything with a job on the card - the plate, the name, the instruction - is
 * drawn after this and covers it, so the texture only ever shows in the space
 * between them.
 */
function drawTexture(page: PDFPage, colour: string) {
  const x0 = TEXTURE_INSET;
  const y0 = TEXTURE_INSET;
  const x1 = W - TEXTURE_INSET;
  const y1 = H - TEXTURE_INSET;
  const ink = hex(colour);

  // Each line is x + y = c, so stepping c walks the field corner to corner.
  for (let c = x0 + y0; c <= x1 + y1; c += TEXTURE_PITCH) {
    // Where that line enters and leaves the rectangle.
    const from = Math.max(x0, c - y1);
    const to = Math.min(x1, c - y0);
    const length = to - from;
    if (length < TEXTURE_PITCH / 2) continue;

    page.drawSvgPath(hairlinePath(length), {
      x: from * K,
      y: PAGE_H - (c - from) * K,
      color: ink,
    });
  }
}

/**
 * One hairline as a filled sliver, in card units from its start point. The
 * y axis runs downwards, the direction `drawSvgPath` reads.
 */
function hairlinePath(length: number): string {
  // Half the width, taken along the diagonal perpendicular to the line.
  const h = (TEXTURE_WIDTH / 2) * Math.SQRT1_2;
  const d = length;

  return [
    `M ${h * K} ${h * K}`,
    `L ${(d + h) * K} ${(-d + h) * K}`,
    `L ${(d - h) * K} ${(-d - h) * K}`,
    `L ${-h * K} ${-h * K}`,
    "Z",
  ].join(" ");
}

/** A rounded rectangle in card units, flipped onto the page. */
function roundedRect(
  page: PDFPage,
  {
    x,
    y,
    width,
    height,
    radius,
    color,
    borderColor,
    borderWidth = 0,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    color?: ReturnType<typeof rgb>;
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
  },
) {
  page.drawSvgPath(roundedPath(width * K, height * K, radius * K), {
    x: x * K,
    y: PAGE_H - y * K,
    color,
    borderColor,
    borderWidth: borderWidth * K,
  });
}

/**
 * A rounded rectangle as SVG path data, drawn from its top left corner
 * downwards - the direction `drawSvgPath` reads, whatever the page's axis does.
 */
function roundedPath(w: number, h: number, radius: number): string {
  const r = Math.min(radius, w / 2, h / 2);
  // A quarter circle in beziers. 0.5523 is what makes four of them meet as a
  // circle rather than a slightly square-shouldered lozenge.
  const c = r * 0.5523;

  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `C ${w - r + c} 0 ${w} ${r - c} ${w} ${r}`,
    `V ${h - r}`,
    `C ${w} ${h - r + c} ${w - r + c} ${h} ${w - r} ${h}`,
    `H ${r}`,
    `C ${r - c} ${h} 0 ${h - r + c} 0 ${h - r}`,
    `V ${r}`,
    `C 0 ${r - c} ${r - c} 0 ${r} 0`,
    "Z",
  ].join(" ");
}

/** Centred on the card, positioned by baseline in card units. */
function centred(
  page: PDFPage,
  text: string,
  {
    font,
    size,
    baseline,
    color,
  }: {
    font: PDFFont;
    size: number;
    baseline: number;
    color: ReturnType<typeof rgb>;
  },
) {
  const pt = size * K;
  page.drawText(text, {
    x: (PAGE_W - font.widthOfTextAtSize(text, pt)) / 2,
    y: PAGE_H - baseline * K,
    size: pt,
    font,
    color,
  });
}

/**
 * The eyebrow, letter by letter. PDF carries character spacing as a text-state
 * operator rather than an argument to a drawn string, and one wordmark is not
 * worth reaching into the content stream for.
 */
function tracked(
  page: PDFPage,
  text: string,
  {
    font,
    size,
    tracking,
    baseline,
    color,
  }: {
    font: PDFFont;
    size: number;
    tracking: number;
    baseline: number;
    color: ReturnType<typeof rgb>;
  },
) {
  const pt = size * K;
  const gap = tracking * K;
  const chars = [...text];
  const width =
    chars.reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, pt), 0) +
    gap * (chars.length - 1);

  let x = (PAGE_W - width) / 2;
  const y = PAGE_H - baseline * K;
  for (const ch of chars) {
    page.drawText(ch, { x, y, size: pt, font, color });
    x += font.widthOfTextAtSize(ch, pt) + gap;
  }
}

function hex(value: string) {
  const parsed = parseHex(value) ?? parseHex(PAPER)!;
  return rgb(parsed.r / 255, parsed.g / 255, parsed.b / 255);
}

/**
 * Event names are free text. The standard PDF faces encode WinAnsi and a
 * character outside it *throws* rather than dropping out, so every one has to
 * be dealt with before it reaches the encoder.
 *
 * Anything WinAnsi holds is left alone; everything else is stripped to its base
 * letter, so Milošević sets as Milosevic rather than losing its last letter.
 * Whitespace collapses too - a newline would push a line off the layout.
 */
function printable(value: string): string {
  return [...value.replace(/\s+/g, " ").trim()].map(toWinAnsi).join("").trim();
}

function toWinAnsi(ch: string): string {
  if (WINANSI.test(ch)) return ch;
  const bare = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (bare.length === 1 && WINANSI.test(bare)) return bare;
  return UNDECOMPOSABLE[ch] ?? "";
}

/** Latin letters with the stroke built into the glyph, so NFD leaves them be. */
const UNDECOMPOSABLE: Record<string, string> = {
  đ: "d",
  Đ: "D",
  ł: "l",
  Ł: "L",
  ı: "i",
  ħ: "h",
};

const WINANSI =
  /^[\x20-\x7e\xa0-\xff\u20ac\u2018\u2019\u201c\u201d\u2013\u2014\u2022\u0160\u0161\u017d\u017e\u0152\u0153\u0178]$/;
