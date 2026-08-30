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
import { formatBytes, describeRetention } from "@/lib/format";

describe("media types", () => {
  it("classifies the formats phones actually produce", () => {
    expect(classify("image/jpeg")).toEqual({ kind: "photo", ext: "jpg" });
    expect(classify("image/heic")).toEqual({ kind: "photo", ext: "heic" });
    expect(classify("video/quicktime")).toEqual({ kind: "video", ext: "mov" });
  });

  it("gives HEIF the same extension as HEIC, because it is the same picture", () => {
    // There were two MIME tables and they disagreed here: one called it
    // "heif", the other folded HEIF into HEIC and called it "heic". The
    // presign route imported from both, so which one an uploaded HEIF got
    // depended on which branch ran. One table now, and this is its answer.
    expect(classify("image/heif")).toEqual({ kind: "photo", ext: "heic" });
    expect(classify("image/heif")).toEqual(classify("image/heic"));
  });

  /**
   * A MIME-only accept list is why a guest can open the picker, see their
   * photos greyed out and be unable to choose any of them. The picker matches
   * on the type the operating system reports, and neither Windows nor most
   * Android builds have a mapping for HEIC - so `image/heic` matches nothing on
   * the device that produced the file.
   */
  it("offers extensions as well as types, so HEIC is selectable", () => {
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain(".heic");
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain(".heif");
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain(".jpg");
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain(".jpeg");
    // The types stay: an iOS camera capture matches on type, not on a name.
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain("image/jpeg");
  });

  /**
   * The reported symptom: a guest on a plan that includes video opens the
   * picker on their phone and can only choose photos.
   *
   * The exact-type list is matched against whatever the phone reports for each
   * item in the camera roll, and for video that is routinely something not on
   * our list - so every clip greys out. The wildcards are the half phones
   * handle reliably, and they have to be present for video to be pickable at
   * all.
   */
  it("offers video to the picker on a phone, not just exact types", () => {
    expect(ACCEPT_ATTRIBUTE_ALL).toContain("video/*");
    expect(ACCEPT_ATTRIBUTE_ALL).toContain("image/*");
    // The exact types and extensions stay for desktop file managers.
    expect(ACCEPT_ATTRIBUTE_ALL).toContain("video/mp4");
    expect(ACCEPT_ATTRIBUTE_ALL).toContain(".mov");
  });

  it("keeps the photo-only picker photo-only", () => {
    // Free plan, and a cover photo. Widening the video half must not leak here.
    expect(ACCEPT_ATTRIBUTE_PHOTO).toContain("image/*");
    expect(ACCEPT_ATTRIBUTE_PHOTO).not.toContain("video/");
    expect(ACCEPT_ATTRIBUTE_PHOTO).not.toContain(".mp4");
  });

  it("is an allowlist, not a blocklist", () => {
    // An unauthenticated upload endpoint invites junk, so anything not named
    // is refused rather than inspected.
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

  it("keeps an event folder shallow: one level of folders, never more", () => {
    // The regression this guards: the layout used to nest originals/, display/
    // and thumbs/ under a `u/` root, so an event was four folders deep and held
    // three copies of every photo. Two copies live in named folders now, but a
    // host opening their own folder should still see the whole event at a
    // glance rather than digging.
    for (const key of [
      mediaKey(scope, media, "jpg"),
      thumbKey(scope, media),
      posterKey(scope, media),
      archiveKey(scope),
    ]) {
      const withinEvent = key.slice(eventPrefix(scope).length);
      expect(withinEvent.split("/").length).toBeLessThanOrEqual(2);
    }
  });

  it("serves both copies without a token", () => {
    expect(publicImageType(thumbKey(scope, media))).toBe("image/webp");
    expect(publicImageType(mediaKey(scope, media, "jpg"))).toBe("image/jpeg");
  });

  it("still serves the flat keys written before the folders existed", () => {
    // Old rows are not backfilled, so their keys have three segments.
    expect(publicImageType(`${owner}/${event}/${media}.webp`)).toBe(
      "image/webp",
    );
    expect(publicImageType(posterKey(scope, media))).toBe("image/webp");
  });

  it("allows only the two folders it knows, not any folder", () => {
    // The rule is a named allowlist, not "one more segment is fine". Anything
    // else under an event stays unreachable.
    expect(publicImageType(`${owner}/${event}/secret/${media}.jpg`)).toBeNull();
    expect(
      publicImageType(`${owner}/${event}/full/nested/${media}.jpg`),
    ).toBeNull();
  });

  it("refuses the archive, however the URL is spelled", () => {
    // `archive` is not one of the two allowed folders. Getting this wrong means
    // a stranger can pull a 30 GB ZIP through the app process by guessing two
    // uuids.
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
