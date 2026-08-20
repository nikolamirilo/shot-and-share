import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComparisonTable } from "@/components/marketing/comparison-table";
import { PricingTable } from "@/components/marketing/pricing-table";
import { FAQS } from "@/lib/faqs";
import { KEEP_FOREVER, TIERS, photoCountLabel } from "@/lib/tiers";

/**
 * The pricing page agreeing with itself.
 *
 * It did not. Plan cards computed their photo counts from the tier table and
 * said 150 and 1,500; a comparison table three sections below, the sign-in
 * page, the hero and the page's own meta description had 250 and 2,500 typed
 * into them - figures from back when a photo was assumed to be 4 MB.
 *
 * A pricing page that contradicts itself is worse than one that is simply
 * wrong, because a reader who notices stops believing the rest of it, and the
 * reader who matters most here is reviewing the store.
 */

const markup = (element: React.ReactElement) => renderToStaticMarkup(element);

/** Every price and count the marketing pages put in front of somebody. */
const pages = () =>
  [markup(<PricingTable />), markup(<ComparisonTable />)].join("\n");

describe("the photo counts agree", () => {
  it("says the same thing about the free plan everywhere", () => {
    const expected = photoCountLabel(TIERS.free.quotaBytes);
    expect(expected).toBe("150");

    const rendered = pages();
    expect(rendered).toContain(expected);
  });

  it("says the same thing about Plus everywhere", () => {
    const expected = photoCountLabel(TIERS.plus.quotaBytes);
    expect(expected).toBe("1,500");

    expect(pages()).toContain(expected);
    expect(FAQS.map(([, answer]) => answer).join("\n")).toContain(expected);
  });

  /*
   * The specific numbers that were wrong. Pinned by value rather than by
   * derivation, because a derived assertion would have passed happily while the
   * page said 250.
   */
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
    expect(rendered).toContain(`€${KEEP_FOREVER.priceEur}`);
  });
});

describe("the rounding is honest", () => {
  /*
   * Two significant figures, because the input is an estimate. "About 146
   * photos" claims a precision nobody measured, and rounding it to 150 is the
   * honest version of the same number.
   */
  it("rounds to two significant figures", () => {
    expect(photoCountLabel(TIERS.free.quotaBytes)).toBe("150");
    expect(photoCountLabel(TIERS.plus.quotaBytes)).toBe("1,500");
    expect(photoCountLabel(TIERS.pro.quotaBytes)).toBe("4,400");
  });
});
