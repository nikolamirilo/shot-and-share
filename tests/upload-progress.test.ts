import { describe, expect, it } from "vitest";

import {
  type Stages,
  START,
  fileFraction,
  runPercent,
} from "@/lib/client/progress";

/**
 * The arithmetic behind the one bar a guest watches.
 *
 * The bug this exists to prevent: the bar filled to about a third, dropped to
 * zero, jumped to a half and then completed. Three separate faults produced
 * that, and each one is a case below - a bar that changed kind halfway through
 * a run, a measurement that only covered one of the several things each file
 * does, and an average over file *count* that could only ever read 0, 50 or
 * 100 for two files.
 *
 * A progress bar that goes backwards is worse than no progress bar, because it
 * tells a guest at a party that their photographs are being lost.
 */

const prepared = (over: Partial<Stages> = {}): Stages => ({
  ...START,
  prepare: 1,
  ...over,
});

describe("one file's share of the bar", () => {
  it("starts at nothing and ends at everything", () => {
    expect(fileFraction(START)).toBe(0);
    expect(fileFraction({ prepare: 1, upload: 1, confirmed: true })).toBe(1);
  });

  it("gives encoding real weight, so the bar moves before any bytes do", () => {
    // Compressing is two encodes on a phone and is a genuine share of the
    // wait. Left at zero the bar sits still through it and reads as stuck,
    // which is what the drifting indeterminate bar was papering over.
    expect(fileFraction({ ...START, prepare: 0.5 })).toBeGreaterThan(0);
    expect(fileFraction(prepared())).toBeGreaterThan(0.1);
    // But not so much that encoding looks like most of the job.
    expect(fileFraction(prepared())).toBeLessThan(0.4);
  });

  it("counts uploading as the bulk of the work", () => {
    const half = fileFraction(prepared({ upload: 0.5 }));
    expect(half).toBeGreaterThan(fileFraction(prepared()));
    expect(half).toBeLessThan(fileFraction(prepared({ upload: 1 })));
  });

  it("leaves something for the confirm, so it never sits at 100 unfinished", () => {
    // The row is written after the last byte lands. A bar that reaches 100 and
    // then waits is a bar that has stopped meaning anything.
    expect(fileFraction(prepared({ upload: 1 }))).toBeLessThan(1);
    expect(
      fileFraction({ prepare: 1, upload: 1, confirmed: true }),
    ).toBe(1);
  });

  it("gives a clip's preparing step almost nothing", () => {
    // All the browser does for a clip is pull one poster frame out of it - a
    // second or two against minutes of upload. Weighted like a photo's two
    // encodes it put a 200 MB clip at 21% before a byte had left the phone,
    // and then left it crawling.
    expect(fileFraction(prepared(), "video")).toBeLessThan(0.05);
    expect(fileFraction(prepared(), "video")).toBeLessThan(
      fileFraction(prepared(), "photo"),
    );
    // What it loses on preparing goes to uploading, which for a clip is
    // essentially the whole wait: almost all of its bar is bytes moving.
    const movedByUpload = (kind: "photo" | "video") =>
      fileFraction(prepared({ upload: 1 }), kind) - fileFraction(prepared(), kind);

    expect(movedByUpload("video")).toBeGreaterThan(movedByUpload("photo"));
    expect(movedByUpload("video")).toBeGreaterThan(0.9);
  });

  it("never reports outside 0 to 1, whatever it is handed", () => {
    // xhr can report loaded > total on some browsers, and a retry restarts at
    // zero. Neither may push the bar off the end.
    expect(fileFraction({ prepare: 2, upload: 3, confirmed: false })).toBe(
      fileFraction({ prepare: 1, upload: 1, confirmed: false }),
    );
    expect(fileFraction({ prepare: -1, upload: -1, confirmed: false })).toBe(0);
  });
});

describe("the run as a whole", () => {
  it("is empty with nothing to do", () => {
    expect(runPercent([])).toBe(0);
  });

  it("weighs a file by its size, not by being one file", () => {
    // A 200 MB clip and a 2 MB photo are not half the wait each. Counting them
    // equally is why the bar jumped to 50% while the clip had barely started.
    const clip = { bytes: 200_000_000, stages: START, kind: "video" as const };
    const photo = {
      bytes: 2_000_000,
      stages: { prepare: 1, upload: 1, confirmed: true },
    };

    // The small photo finishing must barely move the bar.
    expect(runPercent([clip, photo])).toBeLessThan(5);
  });

  it("does not credit a clip a fifth of the bar for cutting one frame", () => {
    const clip = {
      bytes: 200_000_000,
      stages: { ...START, prepare: 1 },
      kind: "video" as const,
    };
    expect(runPercent([clip])).toBeLessThan(5);
  });

  it("does not move in halves when there are two files", () => {
    // The reported symptom. With per-file measurement the bar passes through
    // the middle rather than jumping to it.
    const a = { bytes: 4_000_000, stages: prepared({ upload: 0.4 }) };
    const b = { bytes: 4_000_000, stages: { ...START, prepare: 0.5 } };

    const percent = runPercent([a, b]);
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(50);
    expect(Number.isInteger(percent)).toBe(true);
  });

  it("never goes backwards across a whole realistic run", () => {
    // Two files through every step, interleaved the way the two gates actually
    // run them: one uploads while the other is still being encoded.
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

  it("reaches exactly 100 when everything is confirmed", () => {
    // Not 99. A bar that stops one short of the end is the thing a guest
    // stares at wondering whether to close the page.
    const done = { prepare: 1, upload: 1, confirmed: true };
    expect(
      runPercent([
        { bytes: 1, stages: done },
        { bytes: 999_999, stages: done },
      ]),
    ).toBe(100);
  });

  it("copes with a zero-byte file rather than dividing by nothing", () => {
    expect(
      runPercent([{ bytes: 0, stages: { prepare: 1, upload: 1, confirmed: true } }]),
    ).toBe(100);
  });
});
