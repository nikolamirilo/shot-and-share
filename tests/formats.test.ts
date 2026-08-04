import { describe, expect, it } from "vitest";

import {
  DISPLAY_MAX_EDGE,
  MIN_QUALITY,
  PREFERRED_IMAGE_FORMATS,
  UNIVERSAL_VIDEO_FORMAT,
  imageFormatFromMime,
  isUniversallyViewable,
  isWorthKeeping,
  megapixels,
  normaliseMime,
  sizeBudget,
  videoFormatFromMime,
} from "@/lib/formats";
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
    for (const format of PREFERRED_IMAGE_FORMATS) {
      expect(isUniversallyViewable(format)).toBe(true);
    }
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

  it("keeps a display copy big enough to be worth having", () => {
    expect(DISPLAY_MAX_EDGE).toBeGreaterThanOrEqual(2048);
  });
});

describe("deciding whether to keep the re-encode", () => {
  it("keeps it only when the saving is real", () => {
    // Re-encoding somebody's photograph to save five percent is not a trade
    // worth making.
    expect(isWorthKeeping(4_000_000, 1_000_000)).toBe(true);
    expect(isWorthKeeping(4_000_000, 3_900_000)).toBe(false);
  });

  it("leaves already-small files alone", () => {
    expect(isWorthKeeping(50_000, 10_000)).toBe(false);
  });
});

describe("rendition bookkeeping", () => {
  const row = {
    original_key: "events/e/originals/m.jpg",
    thumb_key: "events/e/thumbs/m.webp",
    display_key: "events/e/display/m.webp",
    poster_key: null,
    size_bytes: 4_000_000,
    thumb_size_bytes: 40_000,
    display_size_bytes: 900_000,
    poster_size_bytes: 0,
  };

  it("enumerates every object a row owns", () => {
    // Missing one here means paying to store renditions of photos that were
    // deleted months ago.
    expect(mediaKeys(row)).toEqual([
      "events/e/originals/m.jpg",
      "events/e/thumbs/m.webp",
      "events/e/display/m.webp",
    ]);
  });

  it("skips renditions that were never created", () => {
    expect(mediaKeys({ original_key: "a.jpg" })).toEqual(["a.jpg"]);
  });

  it("charges the event for every rendition, not just the original", () => {
    expect(mediaBytes(row)).toBe(4_940_000);
    expect(mediaBytes({ size_bytes: 100 })).toBe(100);
  });
});
