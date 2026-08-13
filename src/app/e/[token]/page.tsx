import type { Metadata } from "next";

import { ClosedPage } from "@/components/event/closed-page";
import { EventCover, EventThemeRoot } from "@/components/event/event-cover";
import { GuestExperience } from "@/components/event/guest-experience";
import {
  PlatformFooter,
  PlatformHeader,
} from "@/components/layout/platform-banner";
import { googleFontsHref } from "@/lib/fonts";
import { resolveGuestToken } from "@/lib/guards/guest";
import { loadGuestPage } from "@/lib/views/guest-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const ctx = await resolveGuestToken(token);
  return {
    title: ctx ? `Share your photos from ${ctx.event.name}` : "Share photos",
    // A share link is not something search engines should hold on to.
    robots: { index: false, follow: false },
  };
}

export default async function GuestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const page = await loadGuestPage(token);

  if (page.state === "unknown") {
    return (
      <ClosedPage
        title="This link is not working"
        body="It may have been turned off by the host, or the address may have a typo in it. Ask whoever gave you the code."
      />
    );
  }

  if (page.state === "closed") {
    return (
      <ClosedPage
        title={`${page.eventName} has closed`}
        body="This event is no longer collecting photos. If you still have some on your phone, send them to the host directly."
      />
    );
  }

  const { event, tier, appearance, coverUrl, fullScreenCover } = page;

  // Only the pairing this event uses. Loading all five would put eight font
  // families on a phone on hotel wifi to render one of them, and the house
  // pairing is already in the root layout.
  const fontsHref = googleFontsHref(appearance.font);

  return (
    <EventThemeRoot
      palette={appearance.palette}
      font={appearance.font}
      className="min-h-dvh"
    >
      {fontsHref && (
        <link rel="stylesheet" href={fontsHref} precedence="default" />
      )}

      {/*
       * The platform bar and the cover share one screen-high column, so that
       * "full screen" means the screen. Stacked the obvious way, a 100svh cover
       * starts underneath the bar, which pushes the name and the scroll cue -
       * the two things the cover exists for - below the fold on every phone.
       * A paid event has no bar, so the cover takes the whole column.
       */}
      <div className={fullScreenCover ? "flex min-h-svh flex-col" : undefined}>
        {appearance.platformBranding && <PlatformHeader />}

        <EventCover
          variant={appearance.cover}
          name={event.name}
          date={event.event_date}
          message={event.welcome_message}
          coverUrl={coverUrl}
          palette={appearance.palette}
        />
      </div>

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-5 sm:pb-20 sm:pt-8">
        <GuestExperience
          token={token}
          eventId={event.id}
          galleryVisible={event.gallery_visible}
          galleryLayout={appearance.layout}
          uploadVariant={appearance.upload}
          allowVideo={tier.video}
          maxFileBytes={tier.maxFileBytes}
          remainingBytes={page.remainingBytes}
        />
      </main>

      {/* A paid page ends at the gallery. Nothing below the fold is ours - not
          the small print either, which is the last thing on the page carrying
          our voice rather than the host's. Deleting a photo you uploaded by
          mistake still works; only the instruction goes. */}
      {appearance.platformBranding && (
        <>
          <div>
            <p className="mx-auto max-w-3xl px-4 py-6 text-[0.8125rem] leading-relaxed text-mist sm:px-5">
              Photos you add here go to the host of this event. Uploaded
              something by mistake? Tap it in the gallery above to remove it,
              within the hour.
            </p>
          </div>

          <PlatformFooter />
        </>
      )}
    </EventThemeRoot>
  );
}
