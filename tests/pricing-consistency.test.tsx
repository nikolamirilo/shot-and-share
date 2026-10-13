import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComparisonTable } from "@/components/marketing/ComparisonTable";
import { PricingTable } from "@/components/marketing/PricingTable";
import { FREE_LIMIT_CLAIM, KEEPING, TIERS, photoCountLabel } from "@/lib/tiers";

const markup = (element: React.ReactElement) => renderToStaticMarkup(element);

const pages = () =>
  [markup(<PricingTable />), markup(<ComparisonTable />)].join("\n");

describe("the photo counts agree", () => {
  it("has dropped the counts from the 4 MB era", () => {
    const rendered = pages();
    expect(rendered).not.toContain("250 photos");
    expect(rendered).not.toContain("About 250");
    expect(rendered).not.toContain("2,500");
    expect(rendered).not.toContain("~2,500");
  });
});

describe("the prices agree", () => {
  it("quotes the tier table and nothing else", () => {
    const rendered = pages();
    expect(rendered).toContain(`€${TIERS.plus.priceEur}`);
    expect(rendered).toContain(`€${TIERS.pro.priceEur}`);
    expect(rendered).toContain(`€${KEEPING.plus.priceEur}`);
  });
});

describe("the rounding is honest", () => {
  it("rounds to two significant figures", () => {
    expect(photoCountLabel(TIERS.free.quotaBytes)).toBe("150");
    expect(photoCountLabel(TIERS.plus.quotaBytes)).toBe("1,500");
    expect(photoCountLabel(TIERS.pro.quotaBytes)).toBe("4,400");
  });
});

describe("the free plan's limits are on the card", () => {
  it("says it runs one event at a time", () => {
    expect(markup(<PricingTable />)).toContain(FREE_LIMIT_CLAIM);
  });
});

describe("the plan cards only sell things that exist", () => {
  it("has dropped the two features that were never built", () => {
    const rendered = pages();
    expect(rendered).not.toContain("Multiple albums");
    expect(rendered).not.toContain("albums");
    expect(rendered).not.toContain("Priority support");
  });

  it("has no feature flag that only the pricing page reads", () => {
    const sold = Object.keys(TIERS.pro).filter(
      (key) => typeof TIERS.pro[key as keyof typeof TIERS.pro] === "boolean",
    );
    expect(sold.sort()).toEqual(
      ["bulkZip", "cleanQr", "customPage", "slideshow", "video"].sort(),
    );
  });
});
