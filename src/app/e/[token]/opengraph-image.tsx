import { ImageResponse } from "next/og";

import { THEMES } from "@/lib/appearance/themes";
import { formatEventDate } from "@/lib/format";
import { EventOgCard, OG_SIZE, OgCard } from "@/lib/og-card";
import { fetchCardPhoto } from "@/lib/og-photo";
import { EVENT_LINK, HERO, SITE, heroHeadline } from "@/lib/seo";
import { loadGuestPage } from "@/lib/views/guest-page";

/**
 * The card an event's share link turns into.
 *
 * A share link is not indexed - it is pasted into a group chat, and the chat
 * unfurls it. Until this existed every event unfurled as the product's card:
 * the same claret rectangle selling photo sharing to twelve people who had
 * already been invited to a wedding. This one shows the wedding.
 *
 * Drawn per request rather than cached, because the cover, the name and the
 * theme are all the host's to change up to the morning of the event.
 */
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

  // A link that never worked says nothing about anybody's event, so it falls
  // back to the product's own card rather than leaking a name.
  if (page.state === "unknown") {
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

  // A closed event still has a name worth showing: the link is usually being
  // re-shared weeks later, and "this one has finished" is the useful answer.
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
        date={formatEventDate(event.event_date)}
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
