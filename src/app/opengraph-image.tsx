import { ImageResponse } from "next/og";

import { OG_SIZE, OgCard } from "@/lib/og-card";
import { SITE } from "@/lib/seo";

/**
 * The default social card for the whole site. Every route inherits it unless it
 * declares its own, which is why there is no per-page copy of this file for the
 * legal pages - a terms page shared in a chat should still look like the
 * product.
 */
export const alt = `${SITE.name} - ${SITE.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        kicker="Photo collection for events"
        headline={SITE.tagline}
        footnote="No app, no account, nothing to install."
      />
    ),
    size,
  );
}
