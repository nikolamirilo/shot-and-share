import { describe, expect, it } from "vitest";

import {
  FULL_BYTES_PER_MP,
  THUMB_BYTES_PER_MP,
  THUMB_IMAGE_FORMATS,
  THUMB_MIN_BYTES,
  imageFormatFromMime,
  isUniversallyViewable,
  megapixels,
  normaliseMime,
  sizeBudget,
} from "@/lib/media/formats";
import { mediaBytes, mediaKeys } from "@/lib/media";

describe("format identification", () => {
  it("ignores parameters and case", () => {
    expect(normaliseMime("IMAGE/JPEG; charset=binary")).toBe("image/jpeg");
    expect(imageFormatFromMime("Image/WebP")).toBe("webp");
  });
});

describe("universal viewability", () => {
  it("knows HEIC is the one that strands people", () => {
    // This is the whole reason a conversion path exists: an iPhone photo that
    // Windows, Chrome and Firefox cannot open is not a delivered photo.
    expect(isUniversallyViewable("heic")).toBe(false);
    expect(isUniversallyViewable("jpeg")).toBe(true);
    expect(isUniversallyViewable("png")).toBe(true);
    expect(isUniversallyViewable("webp")).toBe(true);
  });

  it("only ever stores formats that open everywhere", () => {
    for (const format of THUMB_IMAGE_FORMATS) {
      expect(isUniversallyViewable(format)).toBe(true);
    }
  });
});

describe("size budgeting", () => {
  it("scales the budget with the pixel count", () => {
    // Quality is held roughly constant by budgeting per pixel rather than
    // fixing an encoder quality, so a busy photo is pushed harder than a sky.
    expect(megapixels(4000, 3000)).toBeCloseTo(12);
    const small = sizeBudget(1000, 1000, 260_000);
    const large = sizeBudget(4000, 3000, 260_000);
    expect(large).toBeGreaterThan(small * 10);
  });

  it("lets the caller lower the floor for a thumbnail", () => {
    // The default floor is larger than a thumbnail's whole budget, so without
    // a parameter every thumbnail would be encoded to a bigger target than
    // asked for.
    expect(sizeBudget(50, 50, THUMB_BYTES_PER_MP)).toBe(30_000);
    expect(sizeBudget(50, 50, THUMB_BYTES_PER_MP, THUMB_MIN_BYTES)).toBe(6_000);
  });

  it("budgets a full-size photo close to the HEIC it replaces", () => {
    // A 12MP iPhone photo is roughly 2MB as HEIC. Converting to JPEG normally
    // inflates it; the budget is what cancels that out.
    const budget = sizeBudget(4032, 3024, FULL_BYTES_PER_MP);
    expect(budget).toBeGreaterThan(1_600_000);
    expect(budget).toBeLessThan(2_300_000);
  });
});

describe("object bookkeeping", () => {
  const photo = {
    media_key: "o/e/full/m.jpg",
    thumb_key: "o/e/thumb/m.webp",
    size_bytes: 1_950_000,
    thumb_size_bytes: 25_000,
  };

  const video = {
    media_key: "o/e/full/m.mp4",
    poster_key: "o/e/m-poster.webp",
    size_bytes: 4_000_000,
    poster_size_bytes: 40_000,
  };

  it("enumerates every object a row owns", () => {
    // Missing one here means paying to store the thumbnails and poster frames
    // of photos that were deleted months ago.
    expect(mediaKeys(photo)).toEqual(["o/e/full/m.jpg", "o/e/thumb/m.webp"]);
    expect(mediaKeys(video)).toEqual(["o/e/full/m.mp4", "o/e/m-poster.webp"]);
  });

  it("copes with a row written before thumbnails existed", () => {
    expect(mediaKeys({ media_key: "o/e/m.webp" })).toEqual(["o/e/m.webp"]);
    expect(mediaBytes({ size_bytes: 100 })).toBe(100);
  });

  it("charges the event for every object, not just the photo", () => {
    expect(mediaBytes(photo)).toBe(1_975_000);
    expect(mediaBytes(video)).toBe(4_040_000);
  });
});
