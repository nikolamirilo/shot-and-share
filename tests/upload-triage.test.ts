import { describe, expect, it } from "vitest";

import { triage } from "@/lib/client/triage";
import { MB } from "@/lib/tiers";

/**
 * What happens to a handful of files in the half second after the guest
 * picks them, before anything is compressed or sent.
 *
 * The bug this exists to prevent: a guest picked sixty photographs, one of
 * them was a clip over the size limit, and nothing at all was uploaded. The
 * batch used to be all-or-nothing, and anything past the per-pick cap was
 * dropped without a word. Now each file is judged on its own: the ones that
 * cannot go are named with a reason, and the rest go.
 */

// Files with a size but no bytes: `size` is all the triage reads, and building
// real 200 MB buffers in a unit test would be silly.
function fake(name: string, bytes: number, type = "image/jpeg"): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

const LIMITS = { maxFileBytes: 200 * MB, room: 10_000 * MB };

describe("triage", () => {
  it("takes everything when everything fits", () => {
    const files = [fake("a.jpg", 5 * MB), fake("b.jpg", 6 * MB)];
    const result = triage(files, LIMITS);
    expect(result.accepted).toEqual(files);
    expect(result.skipped).toEqual([]);
  });

  it("skips a file over the size limit and keeps the rest", () => {
    const big = fake("clip.mov", 300 * MB, "video/mp4");
    const files = [fake("a.jpg", 5 * MB), big, fake("c.jpg", 5 * MB)];
    const result = triage(files, LIMITS);
    expect(result.accepted.map((f) => f.name)).toEqual(["a.jpg", "c.jpg"]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].file).toBe(big);
    // The reason names the limit, so the guest knows what to do differently.
    expect(result.skipped[0].reason).toContain("200 MB");
    expect(result.skipped[0].upgrade).toBeFalsy();
  });

  it("takes as many as the guest picked, however many that is", () => {
    // There is no cap on the count any more. A guest emptying a camera roll
    // hands over the lot, and only the two limits that cost money apply: the
    // per-file size, and the room left at the event.
    const files = Array.from({ length: 250 }, (_, i) => fake(`${i}.jpg`, 1 * MB));
    const result = triage(files, LIMITS);
    expect(result.accepted).toHaveLength(250);
    expect(result.skipped).toEqual([]);
  });

  it("skips what will not fit in the room left, but keeps smaller files after it", () => {
    // Photos are counted at half size (the browser will compress them); a
    // clip is counted whole. 20 MB of room takes the two 8 MB photos (4 MB
    // each after the estimate) and the 10 MB clip, but not the 40 MB clip.
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
    // Room is the host's problem to fix, so this one carries the upgrade hint.
    expect(result.skipped[0].upgrade).toBe(true);
    expect(result.skipped[0].reason.toLowerCase()).toContain("room");
  });

  it("does not let a skipped file eat the room a later one needed", () => {
    // 5 MB of room. The 12 MB photo (6 MB estimated) is skipped and must not
    // count against the room, or the 4 MB photo (2 MB estimated) after it
    // would be refused as well.
    const files = [fake("big.jpg", 12 * MB), fake("small.jpg", 4 * MB)];
    const result = triage(files, { ...LIMITS, room: 5 * MB });
    expect(result.accepted.map((f) => f.name)).toEqual(["small.jpg"]);
    expect(result.skipped.map((s) => s.file.name)).toEqual(["big.jpg"]);
  });
});

describe("what the guest is told the limits are", () => {
  it("names the per-file size, which is the only limit on one file", async () => {
    const { uploadWording } = await import("@/lib/media");
    const { TIERS } = await import("@/lib/tiers");
    // No count in the copy any more: there is no count limit to name.
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
    // One presign per file, and no cap on how many files a pick may hold. The
    // limiter must not be what cuts a guest off mid-camera-roll.
    const { LIMITS } = await import("@/lib/ratelimit");
    const { BIG_PICK } = await import("@/lib/tiers");
    expect(LIMITS.presign.window).toBe(60);
    expect(LIMITS.presign.limit).toBeGreaterThanOrEqual(4 * BIG_PICK);
  });
});
