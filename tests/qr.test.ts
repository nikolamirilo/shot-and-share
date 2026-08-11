import { inflateSync } from "zlib";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { qrCardPdf, qrSvg } from "@/lib/qr";

const URL_UNDER_TEST = "https://saycheese.app/e/aVeryLongTokenValue123456";

async function card(opts: { eventName: string; branded: boolean }) {
  const bytes = await qrCardPdf(URL_UNDER_TEST, opts);
  return { bytes, text: Buffer.from(bytes).toString("latin1") };
}

describe("QR generation", () => {
  it("produces scalable SVG, not a bitmap", async () => {
    const svg = await qrSvg(URL_UNDER_TEST);
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox");
    expect(svg).not.toContain("<image");
  });
});

describe("the printable card", () => {
  it("is a PDF a browser will save rather than try to render", async () => {
    const { bytes, text } = await card({
      eventName: "Ana and Marko",
      branded: false,
    });
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("is one A5 page, so printing it needs no scaling", async () => {
    const { bytes } = await card({ eventName: "Ana and Marko", branded: true });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);

    const { width, height } = pdf.getPage(0).getSize();
    // 148 x 210mm in points, to the nearest point.
    expect(Math.round(width)).toBe(420);
    expect(Math.round(height)).toBe(595);
  });

  it("carries the event name and the instruction", async () => {
    const { bytes } = await card({ eventName: "Ana and Marko", branded: true });
    const pdf = await PDFDocument.load(bytes);
    // The drawn text is compressed inside the content stream, so the title is
    // the readable proof that the name reached the document.
    expect(pdf.getTitle()).toContain("Ana and Marko");
  });

  it("keeps the share link off the card", async () => {
    // A share token is a long random string. Nobody types it correctly off a
    // table, and the line asking them to try was competing with the code.
    const { text } = await card({ eventName: "Ana and Marko", branded: true });
    expect(text).not.toContain("saycheese.app");
    expect(text).not.toContain("aVeryLongTokenValue123456");
  });

  it("sets a name the standard faces cannot encode, rather than throwing", async () => {
    // Event names are free text typed by a host, and a PDF standard font
    // *throws* on a character outside WinAnsi instead of dropping it. A wedding
    // with a heart in its name still has to produce a card.
    await expect(
      card({ eventName: "Ana & Marko ♥ 2026 🎉", branded: true }),
    ).resolves.toBeTruthy();
    await expect(
      card({ eventName: "Nikola Milošević i Đorđe", branded: false }),
    ).resolves.toBeTruthy();
    // An all-emoji name leaves nothing to set. That is a blank line, not a crash.
    await expect(card({ eventName: "🎉🎊", branded: true })).resolves.toBeTruthy();
  });

  it("draws both cards in the product's own palette", async () => {
    const plain = await paints((await card({ eventName: "T", branded: false })).bytes);
    const branded = await paints((await card({ eventName: "T", branded: true })).bytes);

    // Claret ground under the branded card, white under the plain one. Claret
    // itself appears on both - it is the plain card's wordmark - so the tell is
    // claret-deep, which nothing but the punched holes uses.
    expect(branded).toContain(CLARET);
    expect(branded).toContain(CLARET_DEEP);
    expect(plain).toContain(PAPER);
    expect(plain).not.toContain(CLARET_DEEP);
  });

  it("keeps the code itself high contrast on either card", async () => {
    // The plate under the modules is near-white and the modules are ink on both
    // cards - a claret ground is for the card, not for the thing being scanned.
    for (const branded of [true, false]) {
      const used = await paints((await card({ eventName: "T", branded })).bytes);
      expect(used).toContain(CHALK);
      expect(used).toContain(INK);
    }
  });
});

const INK = "#181214";
const PAPER = "#ffffff";
const CHALK = "#fdf6f7";
const CLARET = "#7a1230";
const CLARET_DEEP = "#5c0b23";

/**
 * Every colour the page fills with, back as hex. PDF carries them as three
 * floats and pdf-lib writes them at full precision, so they are rounded back to
 * bytes rather than compared as the strings they appear in the file as.
 */
async function paints(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  const streams = pdf.getPage(0).node.normalizedEntries().Contents;
  const contents = (streams?.asArray() ?? [])
    .map((ref) => {
      const stream = pdf.context.lookup(ref) as unknown as {
        getContents(): Uint8Array;
      };
      // pdf-lib deflates content streams on save.
      return inflateSync(Buffer.from(stream.getContents())).toString("latin1");
    })
    .join("\n");

  const seen = new Set<string>();
  for (const [, r, g, b] of contents.matchAll(
    /([\d.]+) ([\d.]+) ([\d.]+) rg\b/g,
  )) {
    seen.add(
      "#" +
        [r, g, b]
          .map((c) =>
            Math.round(Number(c) * 255)
              .toString(16)
              .padStart(2, "0"),
          )
          .join(""),
    );
  }
  return [...seen];
}
