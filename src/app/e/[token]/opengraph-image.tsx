import { ImageResponse } from "next/og";

import { THEMES } from "@/lib/appearance/themes";
import { EventOgCard, OG_SIZE, OgCard } from "@/lib/og-card";
import { fetchCardPhoto } from "@/lib/og-photo";
import { EVENT_LINK, HERO, SITE, heroHeadline } from "@/lib/seo";
import { loadGuestPage } from "@/lib/views/guest-page";

export const dynamic = "force-dynamic";

export const alt = `${SITE.name} - ${EVENT_LINK.invitation}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function EventOpengraphImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const page = await loadGuestPage(token);

  if (page.state === "unknown") {
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

  if (page.state === "closed") {
    return new ImageResponse(
      (
        <EventOgCard
          name={page.eventName}
          palette={THEMES[0].palette}
          invitation="This event has closed"
          branding
        />
      ),
      size,
    );
  }

  const { event, appearance, coverUrl } = page;

  return new ImageResponse(
    (
      <EventOgCard
        name={event.name}
        photo={await fetchCardPhoto(coverUrl)}
        palette={appearance.palette}
        invitation={
          appearance.platformBranding
            ? EVENT_LINK.invitationBranded
            : EVENT_LINK.invitation
        }
        branding={appearance.platformBranding}
      />
    ),
    size,
  );
}
