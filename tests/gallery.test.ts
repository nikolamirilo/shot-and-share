import { describe, expect, it } from "vitest";

import { PRELOAD_AHEAD } from "@/constants/gallery";
import { aspectRatio, coerceLayout, neighbours, upcoming, withFreshHead, withOlder } from "@/utils/gallery";
import { type MediaView } from "@/types/media";

describe("gallery layouts", () => {
  it("falls back rather than rendering nothing", () => {
    expect(coerceLayout(undefined)).toBe("grid");
    expect(coerceLayout("nonsense")).toBe("grid");
    expect(coerceLayout("stack")).toBe("stack");
  });
});

describe("masonry aspect ratios", () => {
  it("falls back to a square when dimensions are missing", () => {
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
  const [a, b, c] = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const wall = [a, b, c];

  it("hands back the photo on either side", () => {
    expect(neighbours(wall, "b")).toEqual({ prev: a, next: c });
  });

  it("stops at the last one loaded", () => {
    expect(neighbours(wall, "c")).toEqual({ prev: b, next: null });
  });

  it("goes nowhere from a photo that is no longer there", () => {
    expect(neighbours(wall, "gone")).toEqual({ prev: null, next: null });
  });
});

function shot(id: string, minute: number): MediaView {
  return {
    id,
    kind: "photo",
    width: 3000,
    height: 4000,
    createdAt: `2026-08-13 12:${String(minute).padStart(2, "0")}:00+00`,
    takenAt: `2026-08-13 12:${String(minute).padStart(2, "0")}:00+00`,
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
    const long = Array.from(
      { length: PRELOAD_AHEAD * 2 },
      (_, i) => shot(`p${i}`, i),
    );
    expect(upcoming(long, "p0")).toHaveLength(PRELOAD_AHEAD);
    expect(ids(upcoming(long, "p0"))).toEqual(
      Array.from({ length: PRELOAD_AHEAD }, (_, i) => `p${i + 1}`),
    );
  });

  it("leaves clips alone", () => {
    const mixed = [
      shot("a", 10),
      { ...shot("v", 20), kind: "video" as const },
      shot("b", 30),
    ];
    expect(ids(upcoming(mixed, "a"))).toEqual(["b"]);
  });

  it("gives up on a photograph that is no longer on the wall", () => {
    expect(upcoming(wall, "gone")).toEqual([]);
  });
});

describe("keeping the wall up to date", () => {
  const held = [shot("c", 30), shot("b", 20), shot("a", 10)];

  it("keeps the pages a guest already scrolled to", () => {
    const head = [shot("new", 40), shot("c", 30)];
    expect(ids(withFreshHead(held, head))).toEqual(["new", "c", "b", "a"]);
  });

  it("lets the page it covers say what is gone", () => {
    const head = [shot("c", 30), shot("a", 10)];
    expect(ids(withFreshHead(held, head))).toEqual(["c", "a"]);
  });

  it("does not drop what the page never reached", () => {
    const head = [shot("c", 30)];
    expect(ids(withFreshHead(held, head))).toEqual(["c", "b", "a"]);
  });

  it("empties the wall when the gallery is empty", () => {
    expect(withFreshHead(held, [])).toEqual([]);
  });

  it("ignores a photograph the older page repeats", () => {
    const older = [shot("a", 10), shot("z", 5)];
    expect(ids(withOlder(held, older))).toEqual(["c", "b", "a", "z"]);
  });
});
