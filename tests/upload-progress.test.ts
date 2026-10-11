import { describe, expect, it } from "vitest";

import {
  type Stages,
  START,
  fileFraction,
  runPercent,
} from "@/lib/client/progress";

const prepared = (over: Partial<Stages> = {}): Stages => ({
  ...START,
  prepare: 1,
  ...over,
});

describe("one file's share of the bar", () => {
  it("leaves something for the confirm, so it never sits at 100 unfinished", () => {
    expect(fileFraction(prepared({ upload: 1 }))).toBeLessThan(1);
    expect(
      fileFraction({ prepare: 1, upload: 1, confirmed: true }),
    ).toBe(1);
  });

  it("gives a clip's preparing step almost nothing", () => {
    expect(fileFraction(prepared(), "video")).toBeLessThan(0.05);
    expect(fileFraction(prepared(), "video")).toBeLessThan(
      fileFraction(prepared(), "photo"),
    );
    const movedByUpload = (kind: "photo" | "video") =>
      fileFraction(prepared({ upload: 1 }), kind) - fileFraction(prepared(), kind);

    expect(movedByUpload("video")).toBeGreaterThan(movedByUpload("photo"));
    expect(movedByUpload("video")).toBeGreaterThan(0.9);
  });

  it("never reports outside 0 to 1, whatever it is handed", () => {
    expect(fileFraction({ prepare: 2, upload: 3, confirmed: false })).toBe(
      fileFraction({ prepare: 1, upload: 1, confirmed: false }),
    );
    expect(fileFraction({ prepare: -1, upload: -1, confirmed: false })).toBe(0);
  });
});

describe("the run as a whole", () => {
  it("weighs a file by its size, not by being one file", () => {
    const clip = { bytes: 200_000_000, stages: START, kind: "video" as const };
    const photo = {
      bytes: 2_000_000,
      stages: { prepare: 1, upload: 1, confirmed: true },
    };

    expect(runPercent([clip, photo])).toBeLessThan(5);
  });

  it("never goes backwards across a whole realistic run", () => {
    const steps: Stages[][] = [
      [START, START],
      [{ ...START, prepare: 0.5 }, START],
      [{ prepare: 1, upload: 0, confirmed: false }, { ...START, prepare: 0.5 }],
      [{ prepare: 1, upload: 0.4, confirmed: false }, { ...START, prepare: 0.5 }],
      [{ prepare: 1, upload: 0.4, confirmed: false }, { prepare: 1, upload: 0, confirmed: false }],
      [{ prepare: 1, upload: 1, confirmed: false }, { prepare: 1, upload: 0.3, confirmed: false }],
      [{ prepare: 1, upload: 1, confirmed: true }, { prepare: 1, upload: 0.8, confirmed: false }],
      [{ prepare: 1, upload: 1, confirmed: true }, { prepare: 1, upload: 1, confirmed: true }],
    ];

    const seen = steps.map((stages) =>
      runPercent(stages.map((s) => ({ bytes: 4_000_000, stages: s }))),
    );

    for (let i = 1; i < seen.length; i++) {
      expect(seen[i], `step ${i} after ${seen[i - 1]}`).toBeGreaterThanOrEqual(
        seen[i - 1],
      );
    }
    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(100);
  });

  it("copes with a zero-byte file rather than dividing by nothing", () => {
    expect(
      runPercent([{ bytes: 0, stages: { prepare: 1, upload: 1, confirmed: true } }]),
    ).toBe(100);
  });
});
