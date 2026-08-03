import { describe, expect, it } from "vitest";

import { qrCardSvg, qrSvg, qrSvgPath } from "@/lib/qr";

const URL_UNDER_TEST = "https://saycheese.app/e/aVeryLongTokenValue123456";

describe("QR generation", () => {
  it("produces scalable SVG, not a bitmap", async () => {
    const svg = await qrSvg(URL_UNDER_TEST);
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox");
    expect(svg).not.toContain("<image");
  });

  it("extracts a usable path and module count", async () => {
    const { path, size } = await qrSvgPath(URL_UNDER_TEST);
    expect(path.length).toBeGreaterThan(50);
    expect(size).toBeGreaterThan(20);
  });

  it("renders the printable card with the event name and the short link", async () => {
    const svg = await qrCardSvg(URL_UNDER_TEST, {
      eventName: "Ana and Marko",
      shortUrl: URL_UNDER_TEST,
      branded: false,
    });
    expect(svg).toContain("Ana and Marko");
    expect(svg).toContain("saycheese.app/e/aVeryLongTokenValue123456");
    expect(svg).toContain("Point your camera at the code");
  });

  it("escapes an event name that would otherwise break the SVG", async () => {
    // Event names are free text typed by a host and land straight in markup.
    const svg = await qrCardSvg(URL_UNDER_TEST, {
      eventName: `Tom & Jo <script>alert("x")</script>`,
      shortUrl: URL_UNDER_TEST,
      branded: true,
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("only puts the branded flourishes on the branded card", async () => {
    const plain = await qrCardSvg(URL_UNDER_TEST, {
      eventName: "Test",
      shortUrl: URL_UNDER_TEST,
      branded: false,
    });
    const branded = await qrCardSvg(URL_UNDER_TEST, {
      eventName: "Test",
      shortUrl: URL_UNDER_TEST,
      branded: true,
    });
    // Gouda field and punched holes are the Wedding-tier card.
    expect(plain).toContain('fill="#FFFDF4"');
    expect(branded).toContain('fill="#FFC02E"');
    expect(branded.match(/#4A3110/g)?.length ?? 0).toBeGreaterThan(0);
  });
});
