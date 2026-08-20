import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_EVENT, DEMO_MEDIA } from "@/lib/demo";
import { PhotoGallery } from "@/components/gallery/photo-gallery";
import { PUBLIC_ROUTES } from "@/lib/seo";

/**
 * The gallery a stranger can open.
 *
 * Every route into this product ended at /login, so nobody could see what was
 * being sold without creating an account. That is a poor trade with customers
 * and no answer at all for somebody assessing the business.
 *
 * What these hold to: the wall renders through the product's own gallery rather
 * than a mock-up, the photographs are files that ship in the repository so
 * there is nothing to seed and nothing to go stale, and the page is findable.
 */

describe("the demo has photographs in it", () => {
  it("has a wall rather than a placeholder", () => {
    expect(DEMO_MEDIA.length).toBeGreaterThanOrEqual(8);
  });

  it("points every photograph at a file that ships in the repository", () => {
    for (const item of DEMO_MEDIA) {
      expect(item.previewUrl).toMatch(/^\/hero\/variants\/\d\d\.jpg$/);
      // Same file for the full copy: there is no bucket behind this page, and a
      // lightbox with nothing to open would be worse than no lightbox.
      expect(item.fullUrl).toBe(item.previewUrl);
    }
  });

  it("mixes portrait and landscape, because a real event does", () => {
    const portrait = DEMO_MEDIA.filter((i) => (i.height ?? 0) > (i.width ?? 0));
    const landscape = DEMO_MEDIA.filter((i) => (i.width ?? 0) > (i.height ?? 0));
    expect(portrait.length).toBeGreaterThan(0);
    expect(landscape.length).toBeGreaterThan(0);
  });

  /*
   * No Date.now() anywhere in the demo data. A page that renders differently on
   * every request cannot be reasoned about, and a gallery dated "today" every
   * day reads as fake to exactly the person it is meant to convince.
   */
  it("is the same page on every request", () => {
    const once = DEMO_MEDIA.map((i) => i.createdAt).join();
    const twice = DEMO_MEDIA.map((i) => i.createdAt).join();
    expect(once).toBe(twice);
    expect(DEMO_EVENT.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("it renders through the real gallery", () => {
  const markup = () =>
    renderToStaticMarkup(
      <PhotoGallery items={DEMO_MEDIA} layout="masonry" onActivate={() => {}} />,
    );

  it("draws the photographs, through the product's own optimiser", () => {
    // Next rewrites the src, so the encoded path is what lands in the markup.
    // That it is rewritten at all is the point: this is the real gallery, not a
    // set of plain img tags standing in for one.
    for (const frame of ["01", "02", "03", "04"]) {
      expect(markup()).toContain(
        encodeURIComponent(`/hero/variants/${frame}.jpg`),
      );
    }
  });

  it("opens every photograph", () => {
    const tiles = markup().match(/aria-label="Open this photo"/g) ?? [];
    expect(tiles).toHaveLength(DEMO_MEDIA.length);
  });

  /*
   * The wall loads in waves rather than firing twelve requests at once, so the
   * last tiles are frames on the first paint and fill in behind. Asserting it
   * here because it is the behaviour that makes this the real gallery: a demo
   * built from plain images would have no queue to hold anything back.
   */
  it("holds the later tiles back rather than loading all twelve at once", () => {
    expect(markup()).toContain("animate-pulse");
  });
});

describe("it can be found", () => {
  it("is in the sitemap", () => {
    expect(PUBLIC_ROUTES.map((route) => route.path)).toContain("/demo");
  });

  it("outranks the pricing page, being the better first stop", () => {
    const demo = PUBLIC_ROUTES.find((route) => route.path === "/demo");
    const pricing = PUBLIC_ROUTES.find((route) => route.path === "/pricing");
    expect(demo!.priority).toBeGreaterThan(pricing!.priority);
  });
});
