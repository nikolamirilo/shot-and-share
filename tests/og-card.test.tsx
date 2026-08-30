import { describe, expect, it } from "vitest";

/**
 * The card a link turns into in a chat.
 *
 * What is worth holding is that it renders at all: satori draws these, it
 * takes a deliberately small subset of CSS, and a card that throws at request
 * time is a link that unfurls as a bare URL.
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
});
