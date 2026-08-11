import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

/**
 * QR codes are generated server-side. The code is the actual product - it is
 * the thing that goes on the table - so it gets the same care as the screen
 * does: SVG for the one on the host's dashboard, and a real A5 PDF for the card
 * that comes out of a printer.
 */

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

export interface CardOptions {
  eventName: string;
  /** Wedding tier: the printable card carries the event branding. */
  branded: boolean;
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
 * The branded card is the palette's one loud move: claret ground, chalk type.
 * The plain one is the same card on white. Either way the code itself sits on
 * its own near-white plate, because a scanner wants contrast, not styling.
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
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${opts.eventName} - share your photos`);
  pdf.setCreator("Say Cheese");
  pdf.setProducer("Say Cheese");

  const display = await pdf.embedFont(StandardFonts.HelveticaBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const page = pdf.addPage([PAGE_W, PAGE_H]);

  const ground = opts.branded ? CLARET : PAPER;
  const frame = opts.branded ? CHALK : INK;
  const heading = opts.branded ? CHALK : INK;
  const quiet = opts.branded ? ROSE_SOFT : ASH;
  const eyebrow = opts.branded ? ROSE_SOFT : CLARET;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
    color: hex(ground),
  });

  roundedRect(page, {
    x: 18,
    y: 18,
    width: W - 36,
    height: H - 36,
    radius: 28,
    borderColor: hex(frame),
    borderWidth: 4,
  });

  // The punched holes are the Wedding-tier flourish: the same shape the
  // interface uses as a bullet, dropped a step darker than the ground so they
  // read as debossed rather than as four dots printed on top of it.
  if (opts.branded) {
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
        color: hex(CLARET_DEEP),
      });
    }
  }

  tracked(page, "SAY CHEESE", {
    font: mono,
    size: 18,
    tracking: 3.2,
    baseline: 150,
    color: hex(eyebrow),
  });
  centred(page, printable(opts.headline ?? "Share your photos"), {
    font: display,
    size: 46,
    baseline: 216,
    color: hex(heading),
  });
  centred(page, printable(opts.eventName), {
    font: sans,
    size: 22,
    baseline: 258,
    color: hex(quiet),
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
    color: hex(CHALK),
    borderColor: hex(frame),
    borderWidth: 4,
  });
  drawModules(page, url, { x: qrX, y: qrY, box: qrBox });

  centred(page, "Point your camera at the code", {
    font: display,
    size: 24,
    baseline: qrY + qrBox + 100,
    color: hex(heading),
  });
  centred(page, "No app. No account. Just photos.", {
    font: sans,
    size: 17,
    baseline: H - 48,
    color: hex(quiet),
  });

  return pdf.save();
}

/**
 * The code itself, drawn as filled rectangles rather than as the stroked path
 * `qrcode` emits for SVG. A run of dark modules along a row becomes one
 * rectangle: fewer objects, and no seam where two of them meet. The rows are
 * grown by a hundredth of a module so they overlap instead of abutting, which
 * is invisible at any size and stops a viewer's anti-aliasing from drawing a
 * pale line across the code where a scanner wants solid ink.
 */
function drawModules(
  page: PDFPage,
  url: string,
  { x, y, box }: { x: number; y: number; box: number },
) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  const count = modules.size;
  const unit = (box / count) * K;
  const left = x * K;
  const top = PAGE_H - y * K;
  const bleed = unit * 0.01;

  for (let row = 0; row < count; row += 1) {
    let run = 0;
    for (let col = 0; col <= count; col += 1) {
      const dark = col < count && modules.data[row * count + col] === 1;
      if (dark) {
        run += 1;
        continue;
      }
      if (run > 0) {
        page.drawRectangle({
          x: left + (col - run) * unit,
          y: top - (row + 1) * unit - bleed,
          width: run * unit,
          height: unit + bleed * 2,
          color: hex(INK),
        });
        run = 0;
      }
    }
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
  const w = width * K;
  const h = height * K;
  const r = Math.min(radius * K, w / 2, h / 2);
  // A quarter circle in beziers. 0.5523 is the constant that makes four of them
  // meet as a circle rather than as a slightly square-shouldered lozenge.
  const c = r * 0.5523;

  const path = [
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

  page.drawSvgPath(path, {
    x: x * K,
    y: PAGE_H - y * K,
    color,
    borderColor,
    borderWidth: borderWidth * K,
  });
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
  const n = parseInt(value.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
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
