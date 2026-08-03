import type { Metadata } from "next";
import Link from "next/link";

import { GuestExperience } from "@/app/e/[token]/guest-experience";
import { LogoMark } from "@/components/logo";
import { Hole } from "@/components/ui";
import { gateGuest, resolveGuestToken, storageSummary } from "@/lib/events";
import { formatEventDate } from "@/lib/format";
import { coerceLayout } from "@/lib/gallery";
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

  return (
    <div className="min-h-dvh bg-butter">
      <header className="border-b-2 border-pepper bg-butter">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-5 py-3">
          <LogoMark className="h-8 w-auto" />
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
            Say Cheese
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-20 pt-9">
        <p className="eyebrow">{formatEventDate(event.event_date)}</p>
        <h1 className="mt-3 text-[2.75rem] leading-[0.98] sm:text-[4rem]">
          {event.name}
        </h1>

        {event.welcome_message ? (
          <p className="mt-4 max-w-xl text-lead text-crust">
            {event.welcome_message}
          </p>
        ) : (
          <p className="mt-4 max-w-xl text-lead text-crust">
            Add the photos you took. No account, no app — they go straight to the
            host.
          </p>
        )}

        <GuestExperience
          token={token}
          eventId={event.id}
          galleryVisible={event.gallery_visible}
          galleryLayout={coerceLayout(event.gallery_layout)}
          allowVideo={tier.video}
          maxFileBytes={tier.maxFileBytes}
          remainingBytes={summary.remaining}
        />
      </main>

      <footer className="border-t-2 border-pepper bg-butter">
        <p className="mx-auto max-w-3xl px-5 py-6 text-[0.8125rem] leading-relaxed text-rind">
          Photos you add here go to the host of this event. Uploaded something by
          mistake? Tap it in the gallery below to remove it, within the hour.
        </p>
      </footer>
    </div>
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
