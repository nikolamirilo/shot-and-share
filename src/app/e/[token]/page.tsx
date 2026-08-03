import type { Metadata } from "next";
import Link from "next/link";

import { GuestExperience } from "@/app/e/[token]/guest-experience";
import { EventCover, EventThemeRoot } from "@/components/event-cover";
import { LogoMark } from "@/components/logo";
import { PlatformFooter, PlatformHeader } from "@/components/platform-banner";
import { Hole } from "@/components/ui";
import { resolveAppearance } from "@/lib/appearance";
import type { MediaRow } from "@/lib/db/types";
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
      coverUrl = view.thumbUrl;
    }
  }

  return (
    <EventThemeRoot palette={appearance.palette} className="min-h-dvh">
      {appearance.platformBranding ? (
        <PlatformHeader />
      ) : (
        <header className="border-b-2 border-pepper">
          <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-5 py-3">
            <LogoMark className="h-7 w-auto" />
          </div>
        </header>
      )}

      <EventCover
        variant={appearance.cover}
        name={event.name}
        date={event.event_date}
        message={event.welcome_message}
        coverUrl={coverUrl}
        palette={appearance.palette}
      />

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-8">
        <GuestExperience
          token={token}
          eventId={event.id}
          galleryVisible={event.gallery_visible}
          galleryLayout={appearance.layout}
          allowLayoutChoice={appearance.allowViewerLayoutChoice}
          allowVideo={tier.video}
          maxFileBytes={tier.maxFileBytes}
          remainingBytes={summary.remaining}
        />
      </main>

      <div className="border-t-2 border-pepper">
        <p className="mx-auto max-w-3xl px-5 py-6 text-[0.8125rem] leading-relaxed text-rind">
          Photos you add here go to the host of this event. Uploaded something by
          mistake? Tap it in the gallery above to remove it, within the hour.
        </p>
      </div>

      {appearance.platformBranding && <PlatformFooter />}
    </EventThemeRoot>
  );
}

function ClosedPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-butter px-5 text-center">
      <div className="flex gap-3">
        <Hole size={22} />
        <Hole size={34} />
        <Hole size={16} />
      </div>
      <h1 className="mt-8 max-w-lg text-h1">{title}</h1>
      <p className="mt-4 max-w-md text-body text-crust">{body}</p>
      <Link
        href="/"
        className="mt-8 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind underline"
      >
        What is Say Cheese?
      </Link>
    </div>
  );
}
