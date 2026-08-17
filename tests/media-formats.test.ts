import { describe, expect, it } from "vitest";

import {
  FULL_BYTES_PER_MP,
  FULL_IMAGE_FORMAT,
  MIN_QUALITY,
  THUMB_BYTES_PER_MP,
  THUMB_IMAGE_FORMATS,
  THUMB_MAX_EDGE,
  THUMB_MIN_BYTES,
  UNIVERSAL_VIDEO_FORMAT,
  imageFormatFromMime,
  isUniversallyViewable,
  megapixels,
  normaliseMime,
  sizeBudget,
  videoFormatFromMime,
} from "@/lib/media/formats";
import { mediaBytes, mediaKeys } from "@/lib/media";

describe("format identification", () => {
  it("maps the mime types phones actually send", () => {
    expect(imageFormatFromMime("image/jpeg")).toBe("jpeg");
    expect(imageFormatFromMime("image/heic")).toBe("heic");
    expect(videoFormatFromMime("video/quicktime")).toBe("mov");
  });

  it("treats HEIF and HEIC as one thing", () => {
    // HEIF is the container and HEIC the common profile; iPhones send both
    // labels for what is, for our purposes, the same problem.
    expect(imageFormatFromMime("image/heif")).toBe("heic");
  });

  it("ignores parameters and case", () => {
    expect(normaliseMime("IMAGE/JPEG; charset=binary")).toBe("image/jpeg");
    expect(imageFormatFromMime("Image/WebP")).toBe("webp");
  });

  it("returns null rather than guessing", () => {
    expect(imageFormatFromMime("application/pdf")).toBeNull();
    expect(videoFormatFromMime("image/jpeg")).toBeNull();
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

  it("does not treat AVIF as universal", () => {
    expect(isUniversallyViewable("avif")).toBe(false);
  });

  it("only ever stores formats that open everywhere", () => {
    for (const format of THUMB_IMAGE_FORMATS) {
      expect(isUniversallyViewable(format)).toBe(true);
    }
  });

  it("keeps the downloadable copy in the format that opens anywhere", () => {
    // This is the file a host hands to a print shop or opens in photo
    // software. WebP is fine in browsers and still refused by plenty of both.
    expect(FULL_IMAGE_FORMAT).toBe("jpeg");
    expect(isUniversallyViewable(FULL_IMAGE_FORMAT)).toBe(true);
  });

  it("targets the video container that plays on anything", () => {
    expect(UNIVERSAL_VIDEO_FORMAT).toBe("mp4");
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

  it("keeps a floor so small images are not squeezed into nothing", () => {
    expect(sizeBudget(50, 50, 260_000)).toBeGreaterThanOrEqual(30_000);
  });

  it("never drops quality below the artefact threshold", () => {
    expect(MIN_QUALITY).toBeGreaterThanOrEqual(0.6);
  });

  it("lets the caller lower the floor for a thumbnail", () => {
    // The default floor is larger than a thumbnail's whole budget, so without
    // a parameter every thumbnail would be encoded to a bigger target than
    // asked for.
    expect(sizeBudget(50, 50, THUMB_BYTES_PER_MP)).toBe(30_000);
    expect(sizeBudget(50, 50, THUMB_BYTES_PER_MP, THUMB_MIN_BYTES)).toBe(6_000);
  });

  it("budgets a 640px thumbnail into a few tens of kilobytes", () => {
    // What the grid loads fifty of at once. If this creeps up, the whole
    // reason for storing a second object is gone.
    const budget = sizeBudget(640, 480, THUMB_BYTES_PER_MP, THUMB_MIN_BYTES);
    expect(budget).toBeLessThan(40_000);
    expect(budget).toBeGreaterThan(10_000);
  });

  it("budgets a full-size photo close to the HEIC it replaces", () => {
    // A 12MP iPhone photo is roughly 2MB as HEIC. Converting to JPEG normally
    // inflates it; the budget is what cancels that out.
    const budget = sizeBudget(4032, 3024, FULL_BYTES_PER_MP);
    expect(budget).toBeGreaterThan(1_600_000);
    expect(budget).toBeLessThan(2_300_000);
  });

  it("keeps every pixel of the full-size copy", () => {
    // There is no maximum edge any more. The thumbnail is what gets shrunk.
    expect(THUMB_MAX_EDGE).toBe(640);
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
