import { ImageResponse } from "next/og";

import { OG_SIZE, OgCard } from "@/lib/og-card";
import { HERO, SITE, heroHeadline } from "@/lib/seo";

/**
 * The default social card for the whole site. Every route inherits it unless it
 * declares its own, which is why there is no per-page copy of this file for the
 * legal pages - a terms page shared in a chat should still look like the
 * product.
 *
 * The three lines are the hero's three, read from the same constant the page
 * renders. Somebody who taps a link in a group chat should land on the sentence
 * the card just showed them, not on a different pitch for the same product.
 */
export const alt = `${SITE.name} - ${heroHeadline()}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        kicker={HERO.kicker}
        headline={heroHeadline()}
        footnote={HERO.subline}
      />
    ),
    size,
  );
}
