import { ImageResponse } from "next/og";

import { OG_SIZE, OgCard } from "@/lib/og-card";
import { HERO, SITE, heroHeadline } from "@/lib/seo";

export const alt = `${SITE.name} - ${heroHeadline()}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <OgCard
        kicker={HERO.kicker}
        headline={heroHeadline()}
        footnote={HERO.cardLine}
      />
    ),
    size,
  );
}
