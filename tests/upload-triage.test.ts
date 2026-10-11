import { describe, expect, it } from "vitest";

import { triage } from "@/lib/client/triage";
import { MB } from "@/lib/tiers";

// Files with a size but no bytes: `size` is all the triage reads.
function fake(name: string, bytes: number, type = "image/jpeg"): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

const LIMITS = { maxFileBytes: 200 * MB, room: 10_000 * MB };

describe("triage", () => {
  it("skips a file over the size limit and keeps the rest", () => {
    const big = fake("clip.mov", 300 * MB, "video/mp4");
    const files = [fake("a.jpg", 5 * MB), big, fake("c.jpg", 5 * MB)];
    const result = triage(files, LIMITS);
    expect(result.accepted.map((f) => f.name)).toEqual(["a.jpg", "c.jpg"]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].file).toBe(big);
    expect(result.skipped[0].reason).toContain("200 MB");
    expect(result.skipped[0].upgrade).toBeFalsy();
  });

  it("takes as many as the guest picked, however many that is", () => {
    const files = Array.from({ length: 250 }, (_, i) => fake(`${i}.jpg`, 1 * MB));
    const result = triage(files, LIMITS);
    expect(result.accepted).toHaveLength(250);
    expect(result.skipped).toEqual([]);
  });

  it("skips what will not fit in the room left, but keeps smaller files after it", () => {
    const files = [
      fake("a.jpg", 8 * MB),
      fake("long.mp4", 40 * MB, "video/mp4"),
      fake("b.jpg", 8 * MB),
      fake("short.mp4", 10 * MB, "video/mp4"),
    ];
    const result = triage(files, { ...LIMITS, room: 20 * MB });
    expect(result.accepted.map((f) => f.name)).toEqual([
      "a.jpg",
      "b.jpg",
      "short.mp4",
    ]);
    expect(result.skipped.map((s) => s.file.name)).toEqual(["long.mp4"]);
    expect(result.skipped[0].upgrade).toBe(true);
    expect(result.skipped[0].reason.toLowerCase()).toContain("room");
  });
});

describe("what the guest is told the limits are", () => {
  it("names the per-file size, which is the only limit on one file", async () => {
    const { uploadWording } = await import("@/lib/media");
    const { TIERS } = await import("@/lib/tiers");
    expect(uploadWording(TIERS.free).hint).toBe("Photos, up to 50 MB a file.");
    expect(uploadWording(TIERS.plus).hint).toBe(
      "Photos and video, up to 200 MB a file.",
    );
    expect(uploadWording(TIERS.pro).hint).toBe(
      "Photos and video, up to 500 MB a file.",
    );
    for (const tier of [TIERS.free, TIERS.plus, TIERS.pro]) {
      expect(uploadWording(tier).hint).not.toContain("at a time");
    }
  });

  it("covers a big pick four times over in a minute", async () => {
    const { LIMITS } = await import("@/constants/limits");
    const { BIG_PICK } = await import("@/lib/tiers");
    expect(LIMITS.presign.window).toBe(60);
    expect(LIMITS.presign.limit).toBeGreaterThanOrEqual(4 * BIG_PICK);
  });
});
