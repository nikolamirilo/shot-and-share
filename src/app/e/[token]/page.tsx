import type { Metadata } from "next";

import { ClosedPage } from "@/components/event/ClosedPage";
import { EventCover, EventThemeRoot } from "@/components/event/EventCover";
import { GuestExperience } from "@/components/event/GuestExperience";
import { PlatformBar } from "@/components/layout/PlatformBar";
import { resolveAppearance } from "@/lib/appearance";
import { googleFontsHref } from "@/lib/fonts";
import { resolveGuestToken } from "@/lib/guards/guest";
import { SITE, eventLinkDescription, eventLinkTitle } from "@/lib/seo";
import { loadGuestPage } from "@/lib/views/guest-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const ctx = await resolveGuestToken(token);

  const robots = { index: false, follow: false };

  if (!ctx) {
    return { title: "Share photos", robots };
  }

  const event = ctx.event;
  const { platformBranding } = resolveAppearance(event);
  const title = eventLinkTitle(event.name);
  const description = eventLinkDescription(event.name);

  return {
    title: platformBranding ? title : { absolute: title },
    description,
    robots,
    openGraph: {
      type: "website",
      title,
      description,
      locale: "en_GB",
      siteName: platformBranding ? SITE.name : event.name,
    },
    twitter: { card: "summary_large_image", title, description },
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

  const { event, tier, appearance, coverUrl, coverPreviewUrl, fullScreenCover } =
    page;

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

      {coverPreviewUrl && (
        <link
          rel="preload"
          as="image"
          href={coverPreviewUrl}
          fetchPriority="high"
        />
      )}

      <div className={fullScreenCover ? "flex min-h-svh flex-col" : undefined}>
        <EventCover
          variant={appearance.cover}
          name={event.name}
          coverUrl={coverUrl}
          coverPreviewUrl={coverPreviewUrl}
          palette={appearance.palette}
          position={appearance.coverPosition}
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

      {appearance.platformBranding && (
        <div>
          <p className="mx-auto max-w-3xl px-4 py-6 text-[0.8125rem] leading-relaxed text-mist sm:px-5">
            {tier.video
              ? "Everything you add here goes to the host of this event."
              : "Photos you add here go to the host of this event."}{" "}
            Uploaded something by mistake? Ask the host to take it down.
          </p>
        </div>
      )}

      {appearance.platformBranding && <PlatformBar />}
    </EventThemeRoot>
  );
}
