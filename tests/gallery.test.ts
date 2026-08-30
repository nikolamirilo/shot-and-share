import { describe, expect, it } from "vitest";

import {
  aspectRatio,
  coerceLayout,
  PRELOAD_AHEAD,
  neighbours,
  upcoming,
  withFreshHead,
  withOlder,
} from "@/lib/gallery";
import type { MediaView } from "@/lib/media-view";

describe("gallery layouts", () => {
  it("falls back rather than rendering nothing", () => {
    // A row written before this column existed, or a stale localStorage value,
    // must not blank the gallery.
    expect(coerceLayout(undefined)).toBe("grid");
    expect(coerceLayout("nonsense")).toBe("grid");
    expect(coerceLayout("stack")).toBe("stack");
  });
});

describe("masonry aspect ratios", () => {
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

describe("fetching the next photographs early", () => {
  const wall = [shot("a", 10), shot("b", 20), shot("c", 30), shot("d", 40)];

  it("takes the ones after the open photograph, in the order they are shown", () => {
    expect(ids(upcoming(wall, "a"))).toEqual(["b", "c", "d"]);
  });

  it("goes no further than the window, however long the wall is", () => {
    const long = Array.from({ length: 40 }, (_, i) => shot(`p${i}`, i));
    expect(upcoming(long, "p0")).toHaveLength(PRELOAD_AHEAD);
    expect(ids(upcoming(long, "p0"))).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });

  it("leaves clips alone", () => {
    // A clip plays from a signed URL resolved on opening, and pulling one down
    // in the background would take the whole of a venue's wifi with it.
    const mixed = [
      shot("a", 10),
      { ...shot("v", 20), kind: "video" as const },
      shot("b", 30),
    ];
    expect(ids(upcoming(mixed, "a"))).toEqual(["b"]);
  });

  it("gives up on a photograph that is no longer on the wall", () => {
    // What happens when the open one is reported away mid-look.
    expect(upcoming(wall, "gone")).toEqual([]);
  });
});

describe("keeping the wall up to date", () => {
  // Newest first, which is the order the gallery is served in.
  const held = [shot("c", 30), shot("b", 20), shot("a", 10)];

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

  it("empties the wall when the gallery is empty", () => {
    expect(withFreshHead(held, [])).toEqual([]);
  });

  it("ignores a photograph the older page repeats", () => {
    // New arrivals push the page boundary down, so a page can overlap the one
    // before it. Without this the wall shows a photograph twice, and the
    // lightbox's arrows walk into the duplicate.
    const older = [shot("a", 10), shot("z", 5)];
    expect(ids(withOlder(held, older))).toEqual(["c", "b", "a", "z"]);
  });
});
