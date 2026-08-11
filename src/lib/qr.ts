import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

import type { Palette } from "@/lib/appearance/themes";
import { contrastRatio, mix, parseHex } from "@/lib/color";

/**
 * QR codes are generated server-side. The code is the actual product - it is
 * the thing that goes on the table - so it gets the same care as the screen
 * does: SVG for the one on the host's dashboard, and a real A5 PDF for the card
 * that comes out of a printer.
 *
 * Both are drawn from one plan, so what a host looks at on the dashboard is the
 * artwork that gets printed rather than a different renderer's idea of it.
 */

/**
 * Quartile, not medium. The modules are drawn as separated rounded shapes
 * rather than as a solid grid, which is a small tax on how much of each module
 * is inked, and a code on a table in a dim room has no margin to spare. A
 * quarter of the symbol can be lost and it still reads.
 */
const ECC = "Q";

/** The gap around each module, as a fraction of it. What makes the code breathe. */
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
 * The three big squares in the corners are the finder patterns - the part a
 * scanner looks for first - and they are drawn as one rounded ring with a
 * rounded pupil rather than as 33 separate modules. That is the whole of what
 * makes a code look considered rather than generated: everything else is the
 * same grid it always was, with its corners taken off.
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
 * The code on its own, as SVG. This is what the dashboard shows and what the
 * host's PNG is rasterised from.
 *
 * Four modules of quiet zone, which is what the spec asks for and what a phone
 * held at an angle across a table actually needs.
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
 * The design tokens, written out. The card is generated on a server and printed
 * on somebody else's printer, so it cannot read a stylesheet - these are the
 * same values as `globals.css` and have to be changed in both places.
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
  /** The punched flourish, or nothing on a plain card. */
  holes: string | null;
}

/**
 * The card in the host's own colours.
 *
 * A branded card is the event's accent used at full strength, with the type in
 * whatever the palette says reads on it - `onAccent` is contrast-corrected at
 * the point the palette is built, including for a colour the host typed
 * themselves, so a claret card sets in chalk and a pale gold one sets in ink
 * without either being special-cased here.
 *
 * The code is the exception. It takes the palette's surface and ink rather than
 * the card's, and only if those two are far enough apart - a scanner wants
 * contrast, not styling, and this is the one part of the card that has a job to
 * do besides looking like the event.
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
      holes: null,
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
    holes: palette.accentDeep,
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
  colours: CardColours;
  headline?: string;
}

/**
 * A5 in points, which is what a PDF measures in. 148 x 210mm is the size the
 * card is meant to exist at - one to a table - and putting it in the page box
 * means a host presses print and gets that, rather than whatever their browser
 * decided to scale an image to.
 */
const PAGE_W = 419.53;
const PAGE_H = 595.28;

/**
 * The layout is written in the card's own 600 x 850 grid and scaled onto the
 * page, so the numbers below are readable as a design rather than as
 * millimetres. The two aspect ratios agree to within half a percent.
 */
const W = 600;
const H = 850;
const K = PAGE_W / W;

/**
 * The print-ready card, as a PDF a host can download, mail to a print shop, or
 * open on a phone.
 *
 * There is no link printed on it. A typed share token is a long string of
 * random characters that nobody gets right from a table across a dark room, and
 * the line asking them to try was the one thing on the card competing with the
 * code. The code is the way in.
 *
 * Nothing on it names an occasion either. The same card goes on a wedding
 * table, a fortieth and a company summer party, and the only line that differs
 * between them is the one the host typed themselves.
 *
 * The type is set in the PDF standard faces rather than the product's own. A
 * PDF either carries its fonts inside it or names ones the reader has to
 * already have, and shipping three variable webfonts into the bundle to set
 * four lines of text is not a trade worth making. Helvetica is the same kind of
 * grotesque Archivo is, and the card is recognisably the product's without it.
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
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
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

  // The punched holes are the Wedding-tier flourish: the same shape the
  // interface uses as a bullet, dropped a step darker than the ground so they
  // read as debossed rather than as four dots printed on top of it.
  if (colours.holes) {
    for (const [cx, cy, r] of [
      [76, 96, 26],
      [524, 150, 16],
      [60, 770, 18],
      [536, 742, 30],
    ]) {
      page.drawCircle({
        x: cx * K,
        y: PAGE_H - cy * K,
        size: r * K,
        color: hex(colours.holes),
      });
    }
  }

  tracked(page, "SHOT & SHARE", {
    font: mono,
    size: 18,
    tracking: 3.2,
    baseline: 150,
    color: hex(colours.eyebrow),
  });
  centred(page, printable(opts.headline ?? "Share your photos"), {
    font: display,
    size: 46,
    baseline: 216,
    color: hex(colours.heading),
  });
  centred(page, printable(opts.eventName), {
    font: sans,
    size: 22,
    baseline: 258,
    color: hex(colours.quiet),
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
    baseline: qrY + qrBox + 100,
    color: hex(colours.heading),
  });
  centred(page, "No app. No account. Just photos.", {
    font: sans,
    size: 17,
    baseline: H - 48,
    color: hex(colours.quiet),
  });

  return pdf.save();
}

/**
 * The same shapes the SVG draws, onto the page. Two modules of quiet zone here
 * rather than four: the plate the code sits on is another two modules of the
 * same near-white on every side, so the code gets its four.
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
 * downwards - which is the direction `drawSvgPath` reads, whatever the page's
 * own axis is doing.
 */
function roundedPath(w: number, h: number, radius: number): string {
  const r = Math.min(radius, w / 2, h / 2);
  // A quarter circle in beziers. 0.5523 is the constant that makes four of them
  // meet as a circle rather than as a slightly square-shouldered lozenge.
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
 * operator rather than as an argument to a drawn string, and one wordmark is
 * not worth reaching into the content stream for.
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
 * Event names are free text typed by a host. The standard PDF faces encode
 * WinAnsi, and a character outside it *throws* rather than dropping out, so
 * every one has to be dealt with before it reaches the encoder.
 *
 * Anything WinAnsi already holds is left alone - an é stays an é. Everything
 * else is stripped back to its base letter, which is what saves the names this
 * product is full of: Milošević sets as Milosevic rather than losing its last
 * letter to a silent drop. Only what survives neither goes.
 *
 * Runs of whitespace collapse too. A newline in an event name would otherwise
 * push a line off the layout without saying so.
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
