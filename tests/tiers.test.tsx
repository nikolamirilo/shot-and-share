import { describe, expect, it } from "vitest";

import {
  GB,
  KEEP_FOREVER,
  BIG_PICK,
  MB,
  TIERS,
  TIER_ORDER,
  approxPhotos,
  computeExpiry,
  getTier,
  isUpgrade,
} from "@/lib/tiers";

describe("tiers", () => {
  it("matches the published pricing", () => {
    expect(TIERS.free.priceEur).toBe(0);
    expect(TIERS.plus.priceEur).toBe(19);
    expect(TIERS.pro.priceEur).toBe(39);
    expect(KEEP_FOREVER.priceEur).toBe(29);
  });

  it("gives the storage the pricing page promises", () => {
    expect(TIERS.free.quotaBytes).toBe(1 * GB);
    expect(TIERS.plus.quotaBytes).toBe(10 * GB);
    expect(TIERS.pro.quotaBytes).toBe(30 * GB);
  });

  it("keeps video off the free tier", () => {
    // One 500 MB clip would eat half the free allowance and generate ten times
    // the egress of a photo. This is a cost control, not a feature limit.
    expect(TIERS.free.video).toBe(false);
    expect(TIERS.plus.video).toBe(true);
    expect(TIERS.pro.video).toBe(true);
  });

  it("caps a single file by plan: 50 MB Free, 200 MB Plus, 500 MB Pro", () => {
    // Video is what reaches these numbers - a photo never comes near them -
    // so the top plan gets room for a proper clip while the middle one stays
    // where it was.
    expect(TIERS.free.maxFileBytes).toBe(50 * MB);
    expect(TIERS.plus.maxFileBytes).toBe(200 * MB);
    expect(TIERS.pro.maxFileBytes).toBe(500 * MB);
  });

  it("puts no cap on how many files one pick may hold", () => {
    // The plans differ in room and in what one file may weigh, and in nothing
    // else about picking. A guest emptying a camera roll hands over the lot.
    for (const tier of [TIERS.free, TIERS.plus, TIERS.pro]) {
      expect(tier).not.toHaveProperty("filesPerPick");
    }
    // Kept only to size the presign rate limit, which is one call per file.
    expect(BIG_PICK).toBeGreaterThanOrEqual(300);
  });

  it("stops the top tier short of forever, so the add-on has a job", () => {
    expect(TIERS.pro.retentionDays).toBe(365);
  });

  it("counts expiry from the event date, not the purchase date", () => {
    // A host who buys six months ahead of the wedding must not lose half the
    // window they paid for.
    const expiry = computeExpiry("2026-06-20", TIERS.pro);
    expect(expiry.toISOString().slice(0, 10)).toBe("2027-06-20");
  });

  it("treats a shorter plan as not an upgrade", () => {
    // Compared on rank, never on the id: a variant id is an opaque number from
    // Lemon Squeezy and a bigger one buys nothing extra.
    expect(isUpgrade(TIERS.free.id, TIERS.plus.id)).toBe(true);
    expect(isUpgrade(TIERS.plus.id, TIERS.pro.id)).toBe(true);
    expect(isUpgrade(TIERS.pro.id, TIERS.plus.id)).toBe(false);
    expect(isUpgrade(TIERS.plus.id, TIERS.plus.id)).toBe(false);
  });

  it("resolves an event's stored variant id back to its plan", () => {
    // This is the whole point of storing the variant: a row written by a
    // webhook has to find its way back to a plan without a name in between.
    expect(getTier(TIERS.plus.id).key).toBe("plus");
    expect(getTier(TIERS.pro.id).key).toBe("pro");
  });

  it("gives every plan a distinct id", () => {
    // Two plans sharing an id would silently resolve to whichever was built
    // last, which is exactly the failure a half-configured store produces.
    const ids = TIER_ORDER.map((key) => TIERS[key].id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to free for an id no plan claims", () => {
    // An id off a different Lemon Squeezy store, or off a variant since
    // replaced, is ordinary rather than exceptional. Free is the only safe
    // direction to be wrong in.
    expect(getTier(undefined).key).toBe("free");
    expect(getTier("nonsense").key).toBe("free");
  });

  it("estimates photo counts at 7 MB each", () => {
    // Photos are stored at full resolution now, so the average is a great deal
    // larger than it was - and a modern phone shooting 48MP is most of why.
    expect(approxPhotos(1 * GB)).toBe(150);
    expect(approxPhotos(10 * GB)).toBe(1500);
    expect(approxPhotos(30 * GB)).toBe(4400);
  });

  it("rounds to something a pricing page can print", () => {
    // "about 146 photos" reads as a measurement nobody took. Two significant
    // figures is the most precision the estimate can honestly carry.
    expect(approxPhotos(1 * GB) % 10).toBe(0);
    expect(approxPhotos(10 * GB) % 100).toBe(0);
    // Small numbers keep their precision - rounding 7 up to 10 would be a lie
    // in the expensive direction.
    expect(approxPhotos(7 * MB)).toBe(1);
    expect(approxPhotos(56 * MB)).toBe(8);
  });
});

describe("what the marketing copy promises", () => {
  it("names each paid plan's clip size in the FAQ", async () => {
    // The answer used to say "200 MB" by hand. Once the plans differ, copy
    // that is typed rather than read from the tier is copy that will lie.
    const { FAQS } = await import("@/lib/faqs");
    const answer = FAQS.find(([q]) => q === "Is video included?")?.[1] ?? "";
    expect(answer).toContain("200 MB");
    expect(answer).toContain("500 MB");
  });

  it("puts each plan's own clip size on the pricing table", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { PricingTable } = await import(
      "@/components/marketing/pricing-table"
    );
    const html = renderToStaticMarkup(<PricingTable />);
    expect(html).toContain("Video, up to 200 MB a clip");
    expect(html).toContain("Video, up to 500 MB a clip");
  });
});
