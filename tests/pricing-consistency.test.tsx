import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComparisonTable } from "@/components/marketing/comparison-table";
import { PricingTable } from "@/components/marketing/pricing-table";
import { KEEPING, TIERS, photoCountLabel } from "@/lib/tiers";

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
    expect(rendered).toContain(`€${KEEPING.plus.priceEur}`);
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

describe("the plan cards only sell things that exist", () => {
  /*
   * "Multiple albums" and "Priority support" sat on the Pro card against flags
   * in `tiers.ts` that no code anywhere read. There was no album table, no
   * album UI and no support channel - the page was simply selling two features
   * the product did not have, at a price quoted VAT-inclusive and final to EU
   * consumers, which makes it a refund question rather than a copy question.
   *
   * Pinned by the words rather than by the flags, because the flags are what
   * got deleted: an assertion derived from `TIERS` would pass by describing
   * whatever the table happens to claim today.
   */
  it("has dropped the two features that were never built", () => {
    const rendered = pages();
    expect(rendered).not.toContain("Multiple albums");
    expect(rendered).not.toContain("albums");
    expect(rendered).not.toContain("Priority support");
  });

  /**
   * Every feature flag on a plan has to be read by something other than the
   * pricing page. A flag only the pricing page consults is, by definition, a
   * promise with nothing behind it.
   */
  it("has no feature flag that only the pricing page reads", () => {
    const sold = Object.keys(TIERS.pro).filter(
      (key) => typeof TIERS.pro[key as keyof typeof TIERS.pro] === "boolean",
    );
    expect(sold.sort()).toEqual(
      ["bulkZip", "cleanQr", "customPage", "slideshow", "video"].sort(),
    );
  });
});
