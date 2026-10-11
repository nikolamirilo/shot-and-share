import { describe, expect, it } from "vitest";

import {
  ACCEPT_ATTRIBUTE_ALL,
  ACCEPT_ATTRIBUTE_PHOTO,
  archiveKey,
  classify,
  eventPrefix,
  mediaKey,
  posterKey,
  publicImageType,
  scopeOfEvent,
  scopeOfMedia,
  thumbKey,
} from "@/lib/media";
import { formatBytes, describeRetention } from "@/utils/format";

describe("media types", () => {
  it("classifies the formats phones actually produce", () => {
    expect(classify("image/jpeg")).toEqual({ kind: "photo", ext: "jpg" });
    expect(classify("image/heic")).toEqual({ kind: "photo", ext: "heic" });
    expect(classify("video/quicktime")).toEqual({ kind: "video", ext: "mov" });
  });

  it("gives HEIF the same extension as HEIC, because it is the same picture", () => {
    expect(classify("image/heif")).toEqual({ kind: "photo", ext: "heic" });
    expect(classify("image/heif")).toEqual(classify("image/heic"));
  });

  it("offers extensions as well as types, so HEIC is selectable", () => {
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain(".heic");
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain(".heif");
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain(".jpg");
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain(".jpeg");
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain("image/jpeg");
  });

  it("offers video to the picker on a phone, not just exact types", () => {
    expect(ACCEPT_ATTRIBUTE_ALL).toContain("video/*");
    expect(ACCEPT_ATTRIBUTE_ALL).toContain("image/*");
    expect(ACCEPT_ATTRIBUTE_ALL).toContain("video/mp4");
    expect(ACCEPT_ATTRIBUTE_ALL).toContain(".mov");
  });

  it("keeps the photo-only picker photo-only", () => {
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain("image/*");
    expect(ACCEPT_ATTRIBUTE_PHOTO).not.toContain("video/");
    expect(ACCEPT_ATTRIBUTE_PHOTO).not.toContain(".mp4");
  });

  it("is an allowlist, not a blocklist", () => {
    expect(classify("application/zip")).toBeNull();
    expect(classify("text/html")).toBeNull();
    expect(classify("image/svg+xml")).toBeNull();
    expect(classify("")).toBeNull();
  });
});

describe("key layout", () => {
  const owner = "00000000-1111-2222-3333-444444444444";
  const event = "11111111-2222-3333-4444-555555555555";
  const media = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const scope = { ownerId: owner, eventId: event };

  const everyKind = [
    mediaKey(scope, "photo", media, "jpg"),
    posterKey(scope, media),
    archiveKey(scope),
  ];

  it("keeps every object under its event prefix", () => {
    for (const key of everyKind) {
      expect(key.startsWith(eventPrefix(scope))).toBe(true);
    }
  });

  it("keeps an event folder shallow: two levels of folders, never more", () => {
    for (const key of [
      mediaKey(scope, "photo", media, "jpg"),
      thumbKey(scope, media),
      posterKey(scope, media),
      archiveKey(scope),
    ]) {
      const withinEvent = key.slice(eventPrefix(scope).length);
      expect(withinEvent.split("/").length).toBeLessThanOrEqual(3);
    }
  });

  it("keeps photos and videos in folders of their own", () => {
    const photos = `${eventPrefix(scope)}photos/`;
    const videos = `${eventPrefix(scope)}videos/`;
    expect(mediaKey(scope, "photo", media, "jpg").startsWith(photos)).toBe(true);
    expect(thumbKey(scope, media).startsWith(photos)).toBe(true);
    expect(mediaKey(scope, "video", media, "mp4").startsWith(videos)).toBe(true);
    expect(posterKey(scope, media).startsWith(videos)).toBe(true);
  });

  it("still serves the folders written before photos and videos split", () => {
    expect(publicImageType(`${owner}/${event}/full/${media}.jpg`)).toBe(
      "image/jpeg",
    );
    expect(publicImageType(`${owner}/${event}/thumb/${media}.webp`)).toBe(
      "image/webp",
    );
    expect(publicImageType(`${owner}/${event}/${media}-poster.webp`)).toBe(
      "image/webp",
    );
  });

  it("never serves anything out of the video folder but its posters", () => {
    expect(
      publicImageType(`${owner}/${event}/videos/full/${media}.jpg`),
    ).toBeNull();
    expect(
      publicImageType(`${owner}/${event}/photos/poster/${media}.jpg`),
    ).toBeNull();
  });

  it("serves both copies without a token", () => {
    expect(publicImageType(thumbKey(scope, media))).toBe("image/webp");
    expect(publicImageType(mediaKey(scope, "photo", media, "jpg"))).toBe("image/jpeg");
  });

  it("still serves the flat keys written before the folders existed", () => {
    expect(publicImageType(`${owner}/${event}/${media}.webp`)).toBe(
      "image/webp",
    );
    expect(publicImageType(posterKey(scope, media))).toBe("image/webp");
  });

  it("allows only the two folders it knows, not any folder", () => {
    expect(publicImageType(`${owner}/${event}/secret/${media}.jpg`)).toBeNull();
    expect(
      publicImageType(`${owner}/${event}/full/nested/${media}.jpg`),
    ).toBeNull();
  });

  it("refuses the archive, however the URL is spelled", () => {
    expect(publicImageType(archiveKey(scope))).toBeNull();
    expect(publicImageType(`${owner}/${event}/archive/${event}.zip`)).toBeNull();
    expect(publicImageType(`${owner}/${event}/archive/x.jpg`)).toBeNull();
  });

  it("refuses video, which stays behind a signed URL", () => {
    expect(publicImageType(mediaKey(scope, "video", media, "mp4"))).toBeNull();
    expect(publicImageType(mediaKey(scope, "video", media, "mov"))).toBeNull();
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

  it("describes retention in words a host would use", () => {
    expect(describeRetention(null)).toBe("Kept forever");
    const inFive = new Date(Date.now() + 5 * 86_400_000).toISOString();
    expect(describeRetention(inFive)).toBe("Expires in 5 days");
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(describeRetention(past)).toBe("Expired");
    const inSixMonths = new Date(Date.now() + 180 * 86_400_000).toISOString();
    expect(describeRetention(inSixMonths)).toMatch(/about 6 months/);
  });
});
