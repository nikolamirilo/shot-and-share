import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAYOUT,
  GALLERY_LAYOUTS,
  HOLE_SIZES,
  aspectRatio,
  coerceLayout,
  holeSize,
  isGalleryLayout,
} from "@/lib/gallery";

describe("gallery layouts", () => {
  it("offers the four layouts, each with a name and an explanation", () => {
    expect(GALLERY_LAYOUTS.map((l) => l.id)).toEqual([
      "grid",
      "masonry",
      "holes",
      "stack",
    ]);
    for (const layout of GALLERY_LAYOUTS) {
      expect(layout.name.length).toBeGreaterThan(0);
      expect(layout.hint.length).toBeGreaterThan(10);
    }
  });

  it("defaults to the grid", () => {
    // Uniform squares are the easiest thing to scan on a phone, so that is
    // what a host who never opens settings ships to their guests.
    expect(DEFAULT_LAYOUT).toBe("grid");
  });

  it("accepts only layouts it knows about", () => {
    expect(isGalleryLayout("masonry")).toBe(true);
    expect(isGalleryLayout("carousel")).toBe(false);
    expect(isGalleryLayout(null)).toBe(false);
    expect(isGalleryLayout(7)).toBe(false);
  });

  it("falls back rather than rendering nothing", () => {
    // A row written before this column existed, or a stale localStorage value,
    // must not blank the gallery.
    expect(coerceLayout(undefined)).toBe("grid");
    expect(coerceLayout("nonsense")).toBe("grid");
    expect(coerceLayout("stack")).toBe("stack");
  });
});

describe("holes layout sizing", () => {
  it("is stable for a given position", () => {
    // Sizes cycle rather than randomise: a photo that changed size whenever a
    // new upload arrived would make the wall twitch all night.
    expect(holeSize(3)).toBe(holeSize(3));
    expect(holeSize(0)).toBe(holeSize(HOLE_SIZES.length));
  });

  it("varies unevenly, and never collapses to nothing", () => {
    const first = HOLE_SIZES.slice(0, 4);
    expect(new Set(first).size).toBe(4);
    for (const size of HOLE_SIZES) {
      expect(size).toBeGreaterThan(60);
      expect(size).toBeLessThan(240);
    }
  });
});

describe("masonry aspect ratios", () => {
  it("uses the real shape of the photo", () => {
    expect(aspectRatio(1600, 1200)).toBeCloseTo(4 / 3);
    expect(aspectRatio(1080, 1920)).toBeCloseTo(0.5625);
  });

  it("falls back to a square when dimensions are missing", () => {
    // Thumbnails fail for HEIC in some browsers, and the original still
    // uploads. A missing ratio must not collapse the tile.
    expect(aspectRatio(null, null)).toBe(1);
    expect(aspectRatio(1600, null)).toBe(1);
    expect(aspectRatio(0, 0)).toBe(1);
    expect(aspectRatio(-4, 3)).toBe(1);
  });

  it("clamps extremes so one panorama cannot own the column", () => {
    expect(aspectRatio(10000, 500)).toBe(2.5);
    expect(aspectRatio(500, 10000)).toBe(0.4);
  });
});
