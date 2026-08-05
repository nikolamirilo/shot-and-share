import { describe, expect, it } from "vitest";

import {
  ACCEPTED_MIME,
  archiveKey,
  classify,
  eventPrefix,
  mediaKey,
  ownerPrefix,
  posterKey,
  publicImageType,
  scopeOfEvent,
  scopeOfMedia,
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
    mediaKey(scope, media, "jpg"),
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

  it("puts owner folders at the root of the bucket", () => {
    // No wrapper prefix above them: `aws s3 ls s3://bucket/` lists hosts and
    // nothing else, and a host's own path is one level shorter everywhere it
    // is read by a person.
    for (const key of everyKind) {
      expect(key.startsWith(`${owner}/`)).toBe(true);
    }
  });

  it("keeps one object per upload, directly in the event folder", () => {
    // No originals/ or thumbs/ subfolder, because there is no original and no
    // thumbnail - the compressed photo is the photo.
    expect(mediaKey(scope, media, "jpg")).toBe(
      `${owner}/${event}/${media}.jpg`,
    );
    expect(archiveKey(scope)).toBe(`${owner}/${event}/archive/${event}.zip`);
  });

  it("names a video's poster after the video it belongs to", () => {
    expect(posterKey(scope, media)).toBe(
      `${owner}/${event}/${media}-poster.webp`,
    );
  });

  it("gives an event folder one level of files and no rendition folders", () => {
    // The regression this guards: the layout used to nest originals/, display/
    // and thumbs/ under a `u/` root, so an event was four folders deep and held
    // three copies of every photo. A host opening their own folder in the
    // console should see one file per upload.
    for (const key of [mediaKey(scope, media, "webp"), posterKey(scope, media)]) {
      expect(key.slice(eventPrefix(scope).length)).not.toContain("/");
    }
  });

  it("keeps a replaced extension in the same place", () => {
    // The worker rewrites a HEIC as a JPEG and a MOV as an MP4. Only the
    // extension moves, so the old object is one key away and gets deleted.
    const heic = mediaKey(scope, media, "heic");
    const jpg = mediaKey(scope, media, "jpg");
    expect(heic).not.toBe(jpg);
    expect(heic.replace(/\.heic$/, ".jpg")).toBe(jpg);
  });

  it("serves gallery images publicly and nothing else", () => {
    // /api/media is unauthenticated by design - the key is three uuids and the
    // event link is the access control. What it must never hand out is
    // anything that is not a gallery image.
    expect(publicImageType(mediaKey(scope, media, "webp"))).toBe("image/webp");
    expect(publicImageType(mediaKey(scope, media, "jpg"))).toBe("image/jpeg");
    expect(publicImageType(posterKey(scope, media))).toBe("image/webp");
  });

  it("refuses the archive, however the URL is spelled", () => {
    // Four segments, not three. Getting this wrong means a stranger can pull a
    // 30 GB ZIP through the app process by guessing two uuids.
    expect(publicImageType(archiveKey(scope))).toBeNull();
    expect(publicImageType(`${owner}/${event}/archive/${event}.zip`)).toBeNull();
    expect(publicImageType(`${owner}/${event}/archive/x.jpg`)).toBeNull();
  });

  it("refuses video, which stays behind a signed URL", () => {
    expect(publicImageType(mediaKey(scope, media, "mp4"))).toBeNull();
    expect(publicImageType(mediaKey(scope, media, "mov"))).toBeNull();
  });

  it("refuses anything that is not shaped like an owner-scoped key", () => {
    expect(publicImageType(`${media}.webp`)).toBeNull();
    expect(publicImageType(`${owner}/${media}.webp`)).toBeNull();
    expect(publicImageType(`${owner}/${event}/${media}`)).toBeNull();
    expect(publicImageType("../../etc/passwd")).toBeNull();
    expect(publicImageType(`${owner}/${event}/x.html`)).toBeNull();
    expect(publicImageType(`${owner}/${event}/x.svg`)).toBeNull();
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
