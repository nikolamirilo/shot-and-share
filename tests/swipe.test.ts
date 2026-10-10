import { describe, expect, it } from "vitest";

import { landing, tapDirection } from "@/components/gallery/use-swipe";

/**
 * Where a finger on the lightbox takes the guest. The drag itself is the
 * browser's to run; what is decided here is where it ends up, which is the
 * part that has to feel the same as the photo gallery on their phone.
 */

const WIDTH = 400;
const both = { width: WIDTH, hasPrev: true, hasNext: true };

describe("letting go of a drag", () => {
  it("turns the page once it has gone a quarter of the way", () => {
    expect(landing({ ...both, offset: -101, speed: 0 })).toBe(1);
    expect(landing({ ...both, offset: 101, speed: 0 })).toBe(-1);
  });

  it("springs back from anything shorter, dragged slowly", () => {
    expect(landing({ ...both, offset: -60, speed: 0 })).toBe(0);
    expect(landing({ ...both, offset: 60, speed: -0.1 })).toBe(0);
  });

  it("turns the page on a short, quick flick", () => {
    // A thumb flicked across the photo travels a few dozen pixels. Asking it
    // to cover a quarter of the screen as well would make it feel stuck.
    expect(landing({ ...both, offset: -30, speed: -0.8 })).toBe(1);
    expect(landing({ ...both, offset: 30, speed: 0.8 })).toBe(-1);
  });

  it("does not let a flick one way turn the page the other", () => {
    // Pulled right, then flicked back left as it let go: that is the guest
    // changing their mind, and the strip goes home.
    expect(landing({ ...both, offset: 30, speed: -0.8 })).toBe(0);
  });

  it("stays put at either end of what has loaded", () => {
    expect(
      landing({ ...both, hasNext: false, offset: -300, speed: -2 }),
    ).toBe(0);
    expect(
      landing({ ...both, hasPrev: false, offset: 300, speed: 2 }),
    ).toBe(0);
  });
});

describe("a tap on the photo", () => {
  it("goes forward on the right half and back on the left", () => {
    expect(tapDirection(300, WIDTH)).toBe(1);
    expect(tapDirection(100, WIDTH)).toBe(-1);
  });

  it("calls the exact middle forward", () => {
    expect(tapDirection(200, WIDTH)).toBe(1);
  });
});
