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

const LIMITS = { maxFileBytes: 200 * MB, room: 10_000 * MB, maxCount: 100 };

describe("triage", () => {
  it("takes everything when everything fits", () => {
    const files = [fake("a.jpg", 5 * MB), fake("b.jpg", 6 * MB)];
    const result = triage(files, LIMITS);
    expect(result.accepted).toEqual(files);
    expect(result.skipped).toEqual([]);
    expect(result.leftOut).toBe(0);
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

  it("counts files past the per-pick cap as left out, and does not judge them", () => {
    const files = Array.from({ length: 5 }, (_, i) => fake(`${i}.jpg`, 1 * MB));
    // The sixth is oversized, but it is past the cap so it is not even looked at.
    files.push(fake("huge.jpg", 900 * MB));
    const result = triage(files, { ...LIMITS, maxCount: 3 });
    expect(result.accepted.map((f) => f.name)).toEqual(["0.jpg", "1.jpg", "2.jpg"]);
    expect(result.skipped).toEqual([]);
    expect(result.leftOut).toBe(3);
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

describe("the per-pick cap", () => {
  it("follows the plan, and the hint under the button says so", async () => {
    const { uploadWording } = await import("@/lib/media");
    const { TIERS } = await import("@/lib/tiers");
    expect(uploadWording(TIERS.free).hint).toContain("Photos, up to 20 at a time");
    expect(uploadWording(TIERS.plus).hint).toContain(
      "Photos and video, up to 50 at a time",
    );
    expect(uploadWording(TIERS.pro).hint).toContain(
      "Photos and video, up to 100 at a time",
    );
  });

  it("is covered by the presign rate limit at least four times over in a minute", async () => {
    // One presign per file. A guest who picks the maximum, then does it again
    // straight away, must not be cut off mid-batch by the app's own limiter.
    const { LIMITS } = await import("@/lib/ratelimit");
    const { MAX_FILES_PER_PICK } = await import("@/lib/tiers");
    expect(LIMITS.presign.window).toBe(60);
    expect(LIMITS.presign.limit).toBeGreaterThanOrEqual(4 * MAX_FILES_PER_PICK);
  });
});
