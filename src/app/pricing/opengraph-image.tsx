import { ImageResponse } from "next/og";

import { OG_SIZE, OgCard } from "@/lib/og-card";
import { TIERS } from "@/lib/tiers";

/**
 * Pricing gets its own card because the number is the reason anybody shares
 * this page. It is read from `tiers.ts` for the same reason the structured data
 * is: a price that changed in one place and not the other is a card promising
 * something the page does not.
 */
export const alt = "Pricing - one payment per event, then nothing";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function PricingOpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        kicker="Pricing"
        headline="One payment, per event. Then nothing."
        footnote={`Free plan, then €${TIERS.plus.priceEur} or €${TIERS.pro.priceEur} once. No subscription.`}
      />
    ),
    size,
  );
}
