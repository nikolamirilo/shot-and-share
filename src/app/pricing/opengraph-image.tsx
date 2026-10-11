import { ImageResponse } from "next/og";

import { OG_SIZE, OgCard } from "@/lib/og-card";
import { TIERS } from "@/lib/tiers";

export const alt = "Pricing - one payment per event";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function PricingOpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        kicker="Pricing"
        headline="One payment, per event."
        footnote={`Free plan, then €${TIERS.plus.priceEur} or €${TIERS.pro.priceEur} once. Plans never renew.`}
      />
    ),
    size,
  );
}
