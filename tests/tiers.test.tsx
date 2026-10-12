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
  it("lays the plan's days off the anchor it is given", () => {
    const expiry = computeExpiry("2026-06-20", TIERS.pro);
    expect(expiry.toISOString().slice(0, 10)).toBe("2027-06-20");
  });

  it("resolves an event's stored product id back to its plan", () => {
    expect(getTier(TIERS.plus.id).key).toBe("plus");
    expect(getTier(TIERS.pro.id).key).toBe("pro");
  });

  it("falls back to free for an id no plan claims", () => {
    expect(getTier(undefined).key).toBe("free");
    expect(getTier("nonsense").key).toBe("free");
  });

  it("rounds to something a pricing page can print", () => {
    expect(approxPhotos(1 * GB) % 10).toBe(0);
    expect(approxPhotos(10 * GB) % 100).toBe(0);
    expect(approxPhotos(7 * MB)).toBe(1);
    expect(approxPhotos(56 * MB)).toBe(8);
  });
});

describe("what the marketing copy promises", () => {
  it("names each paid plan's clip size in the FAQ", async () => {
    const { FAQS } = await import("@/lib/faqs");
    const answer = FAQS.find((f) => f.question === "Is video included?")?.answer ?? "";
    expect(answer).toContain("200 MB");
    expect(answer).toContain("500 MB");
  });

  it("puts each plan's own clip size on the pricing table", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { PricingTable } = await import(
      "@/components/marketing/PricingTable"
    );
    const html = renderToStaticMarkup(<PricingTable />);
    expect(html).toContain("Video, up to 200 MB a clip");
    expect(html).toContain("Video, up to 500 MB a clip");
  });
});

describe("recognising a stored tier id", () => {
  it("recognises every plan's own id, and free", () => {
    for (const key of TIER_ORDER) {
      expect(isKnownTierId(TIERS[key].id)).toBe(true);
    }
    expect(isKnownTierId(undefined)).toBe(true);
    expect(isKnownTierId(null)).toBe(true);
  });

  it("does not recognise an id from a previous provider or another account", () => {
    expect(isKnownTierId("858123")).toBe(false);
    expect(isKnownTierId("prod_from_somewhere_else")).toBe(false);
    expect(getTier("858123").key).toBe("free");
  });
});
