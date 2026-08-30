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
  it("gives the code its quiet zone", async () => {
    // Four modules of white on every side. Without them a scanner has nothing
    // to find the symbol's edge against.
    const svg = qrSvg(URL_UNDER_TEST, cardColours(HOUSE, true));
    const extent = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]);
    const first = Number(/<rect x="([\d.]+)"/.exec(svg)![1]);
    expect(first).toBe(4);
    expect(extent).toBeGreaterThan(4 * 2 + 20);
  });
});

describe("the printable card", () => {
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
