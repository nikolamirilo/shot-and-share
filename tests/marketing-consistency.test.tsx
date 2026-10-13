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
  it("never says a price includes VAT, because the checkout adds it", () => {
    const rendered = marketing();
    expect(rendered).not.toContain("includes EU VAT");
    expect(rendered).not.toContain("VAT included");
    expect(termsText).not.toContain("where it applies");
  });

  it("says so next to every price that is charged", () => {
    const rendered = marketing();
    expect(rendered).toContain("once, per event + VAT");
    expect(rendered).toContain("a year + VAT");
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
