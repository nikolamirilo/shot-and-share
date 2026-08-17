import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAYOUT,
  GALLERY_LAYOUTS,
  HOLE_SIZES,
  aspectRatio,
  coerceLayout,
  holeSize,
  isGalleryLayout,
  neighbours,
  withFreshHead,
  withOlder,
} from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

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

describe("stepping between open photos", () => {
  const wall = ["a", "b", "c"];

  it("hands back the photo on either side", () => {
    expect(neighbours(wall, "b")).toEqual({ prev: "a", next: "c" });
  });

  it("stops at the first photo", () => {
    expect(neighbours(wall, "a")).toEqual({ prev: null, next: "b" });
  });

  it("stops at the last one loaded", () => {
    // The gallery pages in with "Show more", so the end of this list is only
    // the end of what has arrived. The arrow greys out rather than fetching:
    // a guest who wants more asks for it.
    expect(neighbours(wall, "c")).toEqual({ prev: "b", next: null });
  });

  it("goes nowhere from a photo that is no longer there", () => {
    // A guest removing their own photo drops it from the list while it is the
    // one on screen. Both arrows must go dead rather than jump somewhere.
    expect(neighbours(wall, "gone")).toEqual({ prev: null, next: null });
  });

  it("goes nowhere when the event has a single photo", () => {
    expect(neighbours(["only"], "only")).toEqual({ prev: null, next: null });
  });
});

/**
 * A photograph as the wall holds it. Only the two fields the merge reads are
 * real; the rest is scenery.
 */
function shot(id: string, minute: number): MediaView {
  return {
    id,
    kind: "photo",
    width: 3000,
    height: 4000,
    createdAt: `2026-08-13 12:${String(minute).padStart(2, "0")}:00+00`,
    uploaderFingerprint: null,
    sizeBytes: 1000,
    previewUrl: `/media/${id}`,
    fullUrl: `/media/${id}`,
    posterUrl: null,
    durationSeconds: null,
    processing: false,
    format: "jpeg",
  };
}

const ids = (items: MediaView[]) => items.map((item) => item.id);

describe("keeping the wall up to date", () => {
  // Newest first, which is the order the gallery is served in.
  const held = [shot("c", 30), shot("b", 20), shot("a", 10)];

  it("puts a photograph that has just arrived at the top", () => {
    const head = [shot("new", 40), shot("c", 30), shot("b", 20), shot("a", 10)];
    expect(ids(withFreshHead(held, head))).toEqual(["new", "c", "b", "a"]);
  });

  it("keeps the pages a guest already scrolled to", () => {
    // The refresh asks for the newest few and gets them. Everything older than
    // that page is the guest's own scrolling, and replacing the list outright
    // is what used to throw it away.
    const head = [shot("new", 40), shot("c", 30)];
    expect(ids(withFreshHead(held, head))).toEqual(["new", "c", "b", "a"]);
  });

  it("lets the page it covers say what is gone", () => {
    // The page reaches back to "a", so it covers "b" too - and "b" did not
    // come back, because the host deleted it. Inside the page's range the
    // server has the last word.
    const head = [shot("c", 30), shot("a", 10)];
    expect(ids(withFreshHead(held, head))).toEqual(["c", "a"]);
  });

  it("does not drop what the page never reached", () => {
    // The same shape, except the page stops at "c". "b" and "a" are older than
    // anything it covers, so its silence about them says nothing - a refresh
    // must not quietly empty the wall below the fold.
    const head = [shot("c", 30)];
    expect(ids(withFreshHead(held, head))).toEqual(["c", "b", "a"]);
  });

  it("never shows the same photograph twice", () => {
    const head = [shot("c", 30), shot("b", 20)];
    expect(ids(withFreshHead(held, head))).toEqual(["c", "b", "a"]);
  });

  it("empties the wall when the gallery is empty", () => {
    expect(withFreshHead(held, [])).toEqual([]);
  });

  it("adds an older page underneath what is held", () => {
    const older = [shot("z", 5), shot("y", 2)];
    expect(ids(withOlder(held, older))).toEqual(["c", "b", "a", "z", "y"]);
  });

  it("ignores a photograph the older page repeats", () => {
    // New arrivals push the page boundary down, so a page can overlap the one
    // before it. Without this the wall shows a photograph twice, and the
    // lightbox's arrows walk into the duplicate.
    const older = [shot("a", 10), shot("z", 5)];
    expect(ids(withOlder(held, older))).toEqual(["c", "b", "a", "z"]);
  });
});
