import { describe, expect, it } from "vitest";

import {
  GB,
  MB,
  TIERS,
  TIER_ORDER,
  approxPhotos,
  computeExpiry,
  getTier,
  isKnownTierId,
} from "@/lib/tiers";

describe("tiers", () => {
  it("counts expiry from the event date, not the purchase date", () => {
    // A host who buys six months ahead of the wedding must not lose half the
    // window they paid for.
    const expiry = computeExpiry("2026-06-20", TIERS.pro);
    expect(expiry.toISOString().slice(0, 10)).toBe("2027-06-20");
  });

  it("resolves an event's stored product id back to its plan", () => {
    // This is the whole point of storing the product: a row written by a
    // webhook has to find its way back to a plan without a name in between.
    expect(getTier(TIERS.plus.id).key).toBe("plus");
    expect(getTier(TIERS.pro.id).key).toBe("pro");
  });

  it("falls back to free for an id no plan claims", () => {
    // An id off a different Creem account, or off a product since replaced,
    // is ordinary rather than exceptional. Free is the only safe direction to
    // be wrong in.
    expect(getTier(undefined).key).toBe("free");
    expect(getTier("nonsense").key).toBe("free");
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

/**
 * Telling "this event is on Free" apart from "we do not recognise this id".
 *
 * `getTier` answers both with Free, which is right for every question about
 * what an event may do and wrong for the one question about how long its photos
 * are kept. See `isKnownTierId` and `updateEventSettings`.
 */
describe("recognising a stored tier id", () => {
  it("recognises every plan's own id, and free", () => {
    for (const key of TIER_ORDER) {
      expect(isKnownTierId(TIERS[key].id)).toBe(true);
    }
    expect(isKnownTierId(undefined)).toBe(true);
    expect(isKnownTierId(null)).toBe(true);
  });

  /*
   * What an event row looks like between deploying a release that changes the
   * tier vocabulary and running the migration that rewrites the rows - and what
   * a row written against a different Creem account looks like forever.
   */
  it("does not recognise an id from a previous provider or another account", () => {
    expect(isKnownTierId("858123")).toBe(false);
    expect(isKnownTierId("prod_from_somewhere_else")).toBe(false);
    // The distinction the whole thing exists for: both resolve to Free.
    expect(getTier("858123").key).toBe("free");
  });
});
