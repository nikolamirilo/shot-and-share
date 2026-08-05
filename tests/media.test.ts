import { describe, expect, it } from "vitest";

import {
  ACCEPTED_MIME,
  archiveKey,
  classify,
  displayKey,
  eventPrefix,
  originalKey,
  ownerPrefix,
  posterKey,
  scopeOfEvent,
  scopeOfMedia,
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
  const owner = "00000000-1111-2222-3333-444444444444";
  const event = "11111111-2222-3333-4444-555555555555";
  const media = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const scope = { ownerId: owner, eventId: event };

  const everyKind = [
    originalKey(scope, media, "jpg"),
    displayKey(scope, media, "webp"),
    thumbKey(scope, media),
    posterKey(scope, media),
    archiveKey(scope),
  ];

  it("keeps every object under its event prefix", () => {
    // Deletion, lifecycle tagging and the ZIP build all rely on this.
    for (const key of everyKind) {
      expect(key.startsWith(eventPrefix(scope))).toBe(true);
    }
  });

  it("keeps every object under its owner prefix", () => {
    // The tenant boundary in the bucket, and what the IAM policy scopes to.
    for (const key of everyKind) {
      expect(key.startsWith(ownerPrefix(owner))).toBe(true);
    }
  });

  it("never puts one host's object inside another host's prefix", () => {
    const other = "99999999-8888-7777-6666-555555555555";
    for (const key of everyKind) {
      expect(key.startsWith(ownerPrefix(other))).toBe(false);
    }
  });

  it("starts every key with the constant segment the infra filters on", () => {
    // s3-lifecycle.json and the IAM policy both match on `u/`. Owner ids are
    // unbounded, so this is the only common prefix the bucket has.
    for (const key of everyKind) {
      expect(key.startsWith("u/")).toBe(true);
    }
  });

  it("puts thumbnails in their own prefix as webp", () => {
    expect(thumbKey(scope, media)).toBe(
      `u/${owner}/${event}/thumbs/${media}.webp`,
    );
    expect(originalKey(scope, media, "heic")).toBe(
      `u/${owner}/${event}/originals/${media}.heic`,
    );
    expect(archiveKey(scope)).toBe(`u/${owner}/${event}/archive/${event}.zip`);
  });

  it("reads a scope off either row shape", () => {
    // events name the columns id/owner_id; media name them event_id/owner_id.
    expect(scopeOfEvent({ id: event, owner_id: owner })).toEqual(scope);
    expect(scopeOfMedia({ event_id: event, owner_id: owner })).toEqual(scope);
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
