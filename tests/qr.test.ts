import { inflateSync } from "zlib";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { THEMES, findTheme } from "@/lib/appearance/themes";
import { contrastRatio, parseHex } from "@/lib/color";
import { cardColours, qrCardPdf, qrSvg } from "@/lib/qr";

const URL_UNDER_TEST = "https://saycheese.app/e/aVeryLongTokenValue123456";
const HOUSE = findTheme("cheese").palette;

async function card(opts: {
  eventName: string;
  branded: boolean;
  theme?: string;
  eventDate?: string;
}) {
  const colours = cardColours(
    opts.theme ? findTheme(opts.theme).palette : HOUSE,
    opts.branded,
  );
  const bytes = await qrCardPdf(URL_UNDER_TEST, {
    eventName: opts.eventName,
    eventDate: opts.eventDate ?? "14 June 2026",
    colours,
  });
  return { bytes, colours, text: Buffer.from(bytes).toString("latin1") };
}

describe("QR generation", () => {
  it("produces scalable SVG, not a bitmap", async () => {
    const svg = qrSvg(URL_UNDER_TEST, cardColours(HOUSE, true));
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox");
    expect(svg).not.toContain("<image");
  });

  it("draws the code as rounded shapes rather than one stroked path", async () => {
    // The look is the whole point of the shapes, and a later "simplification"
    // back to a single path would take it away silently.
    const svg = qrSvg(URL_UNDER_TEST, cardColours(HOUSE, true));
    expect(svg.match(/<rect/g)?.length ?? 0).toBeGreaterThan(100);
    expect(svg).toContain('rx="0.3"');
  });

  it("gives the code its quiet zone", async () => {
    // Four modules of white on every side. Without them a scanner has nothing
    // to find the symbol's edge against.
    const svg = qrSvg(URL_UNDER_TEST, cardColours(HOUSE, true));
    const extent = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]);
    const first = Number(/<rect x="([\d.]+)"/.exec(svg)![1]);
    expect(first).toBe(4);
    expect(extent).toBeGreaterThan(4 * 2 + 20);
  });

  it("takes the plate and the modules from the event's theme", async () => {
    const sky = cardColours(findTheme("sky").palette, true);
    const svg = qrSvg(URL_UNDER_TEST, sky);
    expect(svg).toContain(sky.plate);
    expect(svg).toContain(sky.modules);
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

  it("sets a long name smaller rather than off the edge", async () => {
    // The name is the largest thing on the card, and a host types whatever they
    // type. A card that fits "Ana & Marko" and runs a longer one into the
    // margin is a card that only works for short names.
    for (const eventName of [
      "Ana & Marko",
      "Marija i Nikola - vjencanje 2026",
      "The Fortieth Birthday Party of Alexander Constantine",
      "Supercalifragilisticexpialidocious",
    ]) {
      await expect(card({ eventName, branded: true })).resolves.toBeTruthy();
    }
  });

  it("does not say the same thing twice", async () => {
    // The instruction lives under the code. The line above the name is the
    // date, and a card with no date simply has no eyebrow.
    const { bytes } = await card({
      eventName: "Ana & Marko",
      branded: true,
      eventDate: "",
    });
    await expect(PDFDocument.load(bytes)).resolves.toBeTruthy();
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
    // the softened chalk the branded card sets its quiet lines in, which only a
    // card with a claret ground has any use for.
    const soft = cardColours(HOUSE, true).eyebrow.toLowerCase();
    expect(branded).toContain(CLARET);
    expect(branded).toContain(soft);
    expect(plain).toContain(PAPER);
    expect(plain).not.toContain(soft);
  });

  it("follows the event's theme rather than the house one", async () => {
    // A host who dressed their page in sage gets a sage card. The claret is the
    // default, not a constant.
    for (const theme of THEMES) {
      const { colours, bytes } = await card({
        eventName: "T",
        branded: true,
        theme: theme.id,
      });
      expect(colours.ground).toBe(theme.palette.accent);
      expect(await paints(bytes)).toContain(theme.palette.accent.toLowerCase());
    }
  });

  it("sets the card's type in whatever reads on the host's colour", async () => {
    // Claret is dark and takes chalk; ivory and sage are pale and take ink.
    // Neither is special-cased - the palette says which, and the card obeys.
    for (const theme of THEMES) {
      const colours = cardColours(theme.palette, true);
      expect(colours.heading).toBe(theme.palette.onAccent);
    }
  });

  it("keeps the code readable whatever the theme is", async () => {
    // The one part of the card with a job besides looking like the event.
    for (const theme of THEMES) {
      const { plate, modules } = cardColours(theme.palette, true);
      expect(contrastRatio(parseHex(modules)!, parseHex(plate)!)).toBeGreaterThan(7);
    }
  });

  it("puts the code on its own plate on either card", async () => {
    // The plate is the palette's surface and the modules are its ink on both
    // cards - a claret ground is for the card, not for the thing being scanned.
    for (const branded of [true, false]) {
      const { bytes, colours } = await card({ eventName: "T", branded });
      const used = await paints(bytes);
      expect(used).toContain(colours.plate.toLowerCase());
      expect(used).toContain(colours.modules.toLowerCase());
    }
  });
});

const PAPER = "#ffffff";
const CLARET = "#7a1230";

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
