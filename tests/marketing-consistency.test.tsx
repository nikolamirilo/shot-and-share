import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComparisonTable } from "@/components/marketing/ComparisonTable";
import { PricingSection } from "@/components/marketing/PricingSection";
import { PricingTable } from "@/components/marketing/PricingTable";
import { LEGAL_PAGES } from "@/lib/legal/pages";
import { KEEPING_NAME, VAT_NOTE } from "@/lib/tiers";

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
  it("never calls Keep Forever The Archive", () => {
    const rendered = marketing();
    expect(rendered).not.toContain("The Archive");
    expect(rendered).toContain(KEEPING_NAME);
  });
});
