import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComparisonTable } from "@/components/marketing/comparison-table";
import { PricingSection } from "@/components/marketing/pricing-section";
import { PricingTable } from "@/components/marketing/pricing-table";
import { LEGAL_PAGES } from "@/lib/legal/pages";
import { KEEP_FOREVER, VAT_NOTE } from "@/lib/tiers";

/**
 * The site agreeing with itself about what it sells and what it costs.
 *
 * Each of these was a real contradiction found by somebody reading the pages
 * side by side, which is exactly what a payment reviewer does. None of them was
 * a bug in the usual sense: every page was individually fine and the set of
 * them was not.
 */

const marketing = () =>
  [
    renderToStaticMarkup(<PricingSection />),
    renderToStaticMarkup(<PricingTable />),
    renderToStaticMarkup(<ComparisonTable />),
  ].join("\n");

const termsText = LEGAL_PAGES.terms.sections
  .flatMap((section) => section.body)
  .join("\n");

describe("VAT is one claim, not three", () => {
  /*
   * The homepage badge said "VAT handled at checkout", the pricing page said
   * "include EU VAT", and the terms said "include VAT where it applies".
   * "Handled at checkout" reads like tax might be added on top, and if it were,
   * the published price would be a misleading one under EU display rules.
   */
  it("has dropped the phrasing that implied tax might be added on top", () => {
    const rendered = marketing();
    expect(rendered).not.toContain("VAT handled at checkout");
    expect(rendered).not.toContain("handled at checkout");
    expect(termsText).not.toContain("where it applies");
  });

  it("uses the same sentence in the terms as on the pricing page", () => {
    expect(termsText).toContain(VAT_NOTE);
  });
});

describe("the add-on has one name", () => {
  /*
   * The homepage intro said "add The Archive later" while the card directly
   * below it, the pricing page, the terms and the refund policy all called the
   * same product Keep Forever.
   */
  it("never calls Keep Forever The Archive", () => {
    const rendered = marketing();
    expect(rendered).not.toContain("The Archive");
    expect(rendered).toContain(KEEP_FOREVER.name);
  });
});
