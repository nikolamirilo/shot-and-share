import { describe, expect, it } from "vitest";

import {
  GB,
  KEEP_FOREVER,
  TIERS,
  approxPhotos,
  computeExpiry,
  getTier,
  isUpgrade,
} from "@/lib/tiers";

describe("tiers", () => {
  it("matches the published pricing", () => {
    expect(TIERS.free.priceEur).toBe(0);
    expect(TIERS.event.priceEur).toBe(19);
    expect(TIERS.wedding.priceEur).toBe(39);
    expect(KEEP_FOREVER.priceEur).toBe(29);
  });

  it("gives the storage the pricing page promises", () => {
    expect(TIERS.free.quotaBytes).toBe(1 * GB);
    expect(TIERS.event.quotaBytes).toBe(10 * GB);
    expect(TIERS.wedding.quotaBytes).toBe(30 * GB);
  });

  it("keeps video off the free tier", () => {
    // One 500 MB clip would eat half the free allowance and generate ten times
    // the egress of a photo. This is a cost control, not a feature limit.
    expect(TIERS.free.video).toBe(false);
    expect(TIERS.event.video).toBe(true);
    expect(TIERS.wedding.video).toBe(true);
  });

  it("caps paid uploads at 200 MB a file", () => {
    expect(TIERS.event.maxFileBytes).toBe(200 * 1024 ** 2);
    expect(TIERS.wedding.maxFileBytes).toBe(200 * 1024 ** 2);
  });

  it("stops the top tier short of forever, so the add-on has a job", () => {
    expect(TIERS.wedding.retentionDays).toBe(365);
  });

  it("counts expiry from the event date, not the purchase date", () => {
    // A host who buys six months ahead of the wedding must not lose half the
    // window they paid for.
    const expiry = computeExpiry("2026-06-20", "wedding");
    expect(expiry.toISOString().slice(0, 10)).toBe("2027-06-20");
  });

  it("treats a shorter plan as not an upgrade", () => {
    expect(isUpgrade("free", "event")).toBe(true);
    expect(isUpgrade("event", "wedding")).toBe(true);
    expect(isUpgrade("wedding", "event")).toBe(false);
    expect(isUpgrade("event", "event")).toBe(false);
  });

  it("falls back to free for an unknown tier", () => {
    expect(getTier(undefined).id).toBe("free");
    expect(getTier("nonsense").id).toBe("free");
  });

  it("estimates photo counts at 4 MB each", () => {
    expect(approxPhotos(1 * GB)).toBe(256);
    expect(approxPhotos(10 * GB)).toBe(2560);
  });
});
