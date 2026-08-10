import type { Metadata } from "next";

import { ClosedPage } from "@/components/event/closed-page";
import { GuestExperience } from "@/components/event/guest-experience";
import { EventCover, EventThemeRoot } from "@/components/event/event-cover";
import { PlatformFooter, PlatformHeader } from "@/components/layout/platform-banner";
import { resolveAppearance } from "@/lib/appearance";
import type { MediaRow } from "@/lib/db/types";
import { googleFontsHref } from "@/lib/fonts";
import {
  gateGuest,
  resolveGuestToken,
  storageSummary,
  toMediaView,
} from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTier } from "@/lib/tiers";

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
  const ctx = await resolveGuestToken(token);

  if (!ctx) {
    return (
      <ClosedPage
        title="This link is not working"
        body="It may have been turned off by the host, or the address may have a typo in it. Ask whoever gave you the code."
      />
    );
  }

  const gate = gateGuest(ctx.event);
  if (gate.state !== "open") {
    return (
      <ClosedPage
        title={`${ctx.event.name} has closed`}
        body="This event is no longer collecting photos. If you still have some on your phone, send them to the host directly."
      />
    );
  }

  const event = ctx.event;
  const tier = getTier(event.tier);
  const summary = storageSummary(event);

  // The gate is here, not in the form that wrote these columns. A free event
  // renders as a free event whatever its row happens to contain.
  const appearance = resolveAppearance(event);

  let coverUrl: string | null = null;
  if (event.cover_media_id && appearance.cover !== "type") {
    const admin = createAdminClient();
    const { data } = await admin
      .from("media")
      .select("*")
      .eq("id", event.cover_media_id)
      .eq("status", "ready")
      .maybeSingle();
    if (data) {
      const view = await toMediaView(data as MediaRow);
      coverUrl = view.previewUrl;
    }
  }

  /*
   * Whether the cover about to render is the screen-filling one.
   *
   * It has to match what EventCover decides rather than what the row says: a
   * "Full screen" cover with no photo falls back to "Just type", and stretching
   * that short header down a whole screen is a page with a hole in it.
   */
  const fullScreenCover = appearance.cover === "full" && coverUrl !== null;

  // Only the pairing this event actually uses. Loading all five would put eight
  // font families on a phone on hotel wifi in order to render one of them, and
  // the house pairing is already in the root layout, so the default costs
  // nothing at all.
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
       * starts *underneath* the bar, which pushes the name and the scroll cue -
       * the two things the cover exists for - below the fold on every phone.
       * Here the bar takes what it needs and the cover takes the rest. A paid
       * event has no bar at all, so the cover takes the whole column.
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
          remainingBytes={summary.remaining}
        />
      </main>

      {/* A paid page ends at the gallery. Nothing below the fold is ours -
          not the small print either, which is the last thing on the page
          carrying our voice rather than the host's. Deleting a photo you
          uploaded by mistake still works; only the instruction goes. */}
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
