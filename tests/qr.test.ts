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

  it("renders the printable card with the event name and the instruction", async () => {
    const svg = await qrCardSvg(URL_UNDER_TEST, {
      eventName: "Ana and Marko",
      branded: false,
    });
    expect(svg).toContain("Ana and Marko");
    expect(svg).toContain("Point your camera at the code");
  });

  it("keeps the share link off the card", async () => {
    // A share token is a long random string. Nobody types it correctly off a
    // table, and the line asking them to try was competing with the code.
    const svg = await qrCardSvg(URL_UNDER_TEST, {
      eventName: "Ana and Marko",
      branded: true,
    });
    expect(svg).not.toContain("saycheese.app");
    expect(svg).not.toContain("aVeryLongTokenValue123456");
  });

  it("escapes an event name that would otherwise break the SVG", async () => {
    // Event names are free text typed by a host and land straight in markup.
    const svg = await qrCardSvg(URL_UNDER_TEST, {
      eventName: `Tom & Jo <script>alert("x")</script>`,
      branded: true,
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("draws both cards in the product's own palette", async () => {
    const plain = await qrCardSvg(URL_UNDER_TEST, {
      eventName: "Test",
      branded: false,
    });
    const branded = await qrCardSvg(URL_UNDER_TEST, {
      eventName: "Test",
      branded: true,
    });
    // The claret field and the punched holes are the Wedding-tier card; the
    // plain one is the same card on white. Neither carries the old amber.
    expect(plain).toContain('fill="#ffffff"');
    expect(plain).not.toContain("#FFC02E");
    expect(branded).toContain('fill="#7a1230"');
    expect(branded.match(/#5c0b23/g)?.length ?? 0).toBeGreaterThan(0);
  });

  it("keeps the code itself high contrast on either card", async () => {
    // The plate under the modules is near-white and the modules are ink on both
    // cards - a claret ground is for the card, not for the thing being scanned.
    const branded = await qrCardSvg(URL_UNDER_TEST, {
      eventName: "Test",
      branded: true,
    });
    expect(branded).toContain('fill="#fdf6f7"');
    expect(branded).toContain('stroke="#181214" stroke-width="1"');
  });
});
