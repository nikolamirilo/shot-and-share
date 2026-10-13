import type { Metadata } from "next";
import Link from "next/link";

import { NewEventForm } from "@/components/dashboard/NewEventForm";
import { ButtonLink, Eyebrow, Hole } from "@/components/ui";
import { countFreeEvents } from "@/lib/db/event-repo";
import { requireUser } from "@/lib/guards/host-action";
import {
  FREE_LIMIT_CLAIM,
  FREE_LIMIT_NOTICE,
  MAX_FREE_EVENTS,
  TIERS,
  approxPhotos,
} from "@/lib/tiers";
import { formatBytes } from "@/utils/format";
import { MdArrowBackIosNew } from "react-icons/md";

export const metadata: Metadata = { title: "New event" };
export const dynamic = "force-dynamic";

function BackToEvents() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-2 py-1 font-mono text-micro uppercase tracking-[0.16em] text-mist hover:underline"
    >
      <MdArrowBackIosNew aria-hidden className="shrink-0" /> All events
    </Link>
  );
}

export default async function NewEventPage() {
  const { supabase, user } = await requireUser();
  const freeEvents = await countFreeEvents(supabase, user.id);

  if (freeEvents >= MAX_FREE_EVENTS) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-10">
        <BackToEvents />

        <Eyebrow className="mt-6">New event</Eyebrow>
        <h1 className="mt-3 text-[2.25rem] sm:text-h1">
          You already have a free event.
        </h1>
        <p className="mt-3 max-w-xl text-body text-ash">{FREE_LIMIT_NOTICE}</p>
        <p className="mt-3 max-w-xl text-[0.9375rem] text-mist">
          Upgrading is done from the event itself, and a paid event no longer
          counts against this.
        </p>

        <ButtonLink
          href="/dashboard"
          size="lg"
          className="mt-7 w-full sm:w-auto"
        >
          Back to my events
        </ButtonLink>
      </div>
    );
  }

  const free = TIERS.free;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-10">
      <BackToEvents />

      <Eyebrow className="mt-6">New event</Eyebrow>
      <h1 className="mt-3 text-[2.25rem] sm:text-h1">
        What are we collecting photos from?
      </h1>
      <p className="mt-3 max-w-xl text-body text-ash">
        Just a name. You get a link and a printable QR code straight after, and
        you can change it later.
      </p>

      <div className="mt-8 grid gap-5 sm:mt-9 sm:gap-8 md:grid-cols-[1.2fr_1fr]">
        <NewEventForm />

        <aside className="card h-fit p-5 sm:p-6">
          <h2 className="text-h3">Starts on {free.name}</h2>
          <p className="mt-1 text-[0.9375rem] text-ash">{free.meaning}</p>
          <ul className="mt-5 space-y-2.5">
            {[
              `${formatBytes(free.quotaBytes, 0)}, about ${approxPhotos(free.quotaBytes)} photos`,
              "Unlimited guests",
              "Clean QR code, no watermark",
              "Bulk ZIP download",
              `Photos kept for ${free.retentionDays} days`,
              FREE_LIMIT_CLAIM,
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <Hole size={9} className="mt-2" />
                <span className="text-[0.9375rem] leading-snug">{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[0.8125rem] leading-relaxed text-mist">
            Upgrade any time, including during the event. Buying a bigger plan
            raises the limit immediately and extends how long the photos are
            kept.
          </p>
        </aside>
      </div>
    </div>
  );
}
