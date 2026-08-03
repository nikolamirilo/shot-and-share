import { describe, expect, it } from "vitest";

import {
  ACCEPTED_MIME,
  archiveKey,
  classify,
  eventPrefix,
  originalKey,
  thumbKey,
} from "@/lib/media";
import { formatBytes, describeRetention, pluralise } from "@/lib/format";

describe("media types", () => {
  it("classifies the formats phones actually produce", () => {
    expect(classify("image/jpeg")).toEqual({ kind: "photo", ext: "jpg" });
    expect(classify("image/heic")).toEqual({ kind: "photo", ext: "heic" });
    expect(classify("video/quicktime")).toEqual({ kind: "video", ext: "mov" });
  });

  it("ignores charset parameters and case", () => {
    expect(classify("IMAGE/JPEG; charset=binary")?.ext).toBe("jpg");
  });

  it("is an allowlist, not a blocklist", () => {
    // An unauthenticated upload endpoint invites junk, so anything not named
    // is refused rather than inspected.
    expect(classify("application/zip")).toBeNull();
    expect(classify("text/html")).toBeNull();
    expect(classify("image/svg+xml")).toBeNull();
    expect(classify("")).toBeNull();
  });

  it("does not accept anything executable", () => {
    for (const mime of ACCEPTED_MIME) {
      expect(mime.startsWith("image/") || mime.startsWith("video/")).toBe(true);
    }
  });
});

describe("key layout", () => {
  const event = "11111111-2222-3333-4444-555555555555";
  const media = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("keeps every object under its event prefix", () => {
    // Deletion, lifecycle tagging and the ZIP build all rely on this.
    for (const key of [
      originalKey(event, media, "jpg"),
      thumbKey(event, media),
      archiveKey(event),
    ]) {
      expect(key.startsWith(eventPrefix(event))).toBe(true);
    }
  });

  it("puts thumbnails in their own prefix as webp", () => {
    expect(thumbKey(event, media)).toBe(`events/${event}/thumbs/${media}.webp`);
    expect(originalKey(event, media, "heic")).toBe(
      `events/${event}/originals/${media}.heic`,
    );
  });
});

describe("formatting", () => {
  it("formats byte sizes the way the pricing page states them", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1024 ** 3)).toBe("1 GB");
    expect(formatBytes(10 * 1024 ** 3, 0)).toBe("10 GB");
  });

  it("never shows a negative size", () => {
    expect(formatBytes(-5)).toBe("0 B");
  });

  it("describes retention in words a host would use", () => {
    expect(describeRetention(null)).toBe("Kept forever");
    const inFive = new Date(Date.now() + 5 * 86_400_000).toISOString();
    expect(describeRetention(inFive)).toBe("Expires in 5 days");
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(describeRetention(past)).toBe("Expired");
    const inSixMonths = new Date(Date.now() + 180 * 86_400_000).toISOString();
    expect(describeRetention(inSixMonths)).toMatch(/about 6 months/);
  });

  it("pluralises", () => {
    expect(pluralise(1, "time")).toBe("1 time");
    expect(pluralise(0, "time")).toBe("0 times");
    expect(pluralise(2, "photo")).toBe("2 photos");
  });
});
