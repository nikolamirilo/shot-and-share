import { describe, expect, it } from "vitest";

import { HERO, SITE, heroHeadline } from "@/lib/seo";

/**
 * The card a link turns into in a chat.
 *
 * Two things are worth holding. That it renders at all: satori draws these, it
 * takes a deliberately small subset of CSS, and a card that throws at request
 * time is a link that unfurls as a bare URL. And that it says what the landing
 * page says - the copy used to be written out twice, so the page could be
 * given a new headline while the card kept selling the old one.
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function render(route: { default: () => Response }) {
  const buf = Buffer.from(await route.default().arrayBuffer());
  return buf;
}

describe("the social card", () => {
  it("is a PNG at the size the crawlers are told to expect", async () => {
    const route = await import("@/app/opengraph-image");
    const png = await render(route);

    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    expect(route.size).toEqual({ width: 1200, height: 630 });
    expect(route.contentType).toBe("image/png");
  });

  it("carries the hero's own words, not a second copy of them", async () => {
    const { alt } = await import("@/app/opengraph-image");

    expect(alt).toBe(`${SITE.name} - Let your guests capture the moments you miss`);
    expect(alt).toContain(heroHeadline());
    // Two lines on the card, one sentence in an alt attribute.
    expect(heroHeadline()).toBe(HERO.headlineLines.join(" "));
  });

  // Pricing says its own thing, and its number comes from `tiers.ts`.
  it("still renders the pricing card", async () => {
    const route = await import("@/app/pricing/opengraph-image");
    const png = await render(route);

    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
  });
});
