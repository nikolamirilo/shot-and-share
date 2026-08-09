import type { Metadata } from "next";
import Link from "next/link";

import { NewEventForm } from "@/app/dashboard/events/new/form";
import { Eyebrow, Hole } from "@/components/ui";
import { TIERS } from "@/lib/tiers";
import { formatBytes } from "@/lib/format";
import { approxPhotos } from "@/lib/tiers";
import { MdArrowBackIosNew } from "react-icons/md";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage() {
  const free = TIERS.free;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-5 sm:py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 py-1 font-mono text-micro uppercase tracking-[0.16em] text-rind hover:underline"
      >
        <MdArrowBackIosNew aria-hidden className="shrink-0" /> All events
      </Link>

      <Eyebrow className="mt-6">New event</Eyebrow>
      <h1 className="mt-3 text-[2.25rem] sm:text-h1">
        What are we collecting photos from?
      </h1>
      <p className="mt-3 max-w-xl text-body text-crust">
        Two fields. You get a link and a printable QR code straight after, and
        you can change any of this later.
      </p>

      <div className="mt-8 grid gap-5 sm:mt-9 sm:gap-8 md:grid-cols-[1.2fr_1fr]">
        <NewEventForm />

        <aside className="card h-fit p-5 sm:p-6">
          <h2 className="text-h3">Starts on {free.name}</h2>
          <p className="mt-1 text-[0.9375rem] text-crust">{free.meaning}</p>
          <ul className="mt-5 space-y-2.5">
            {[
              `${formatBytes(free.quotaBytes, 0)}, about ${approxPhotos(free.quotaBytes)} photos`,
              "Unlimited guests",
              "Clean QR code, no watermark",
              "Bulk ZIP download",
              `Photos kept for ${free.retentionDays} days`,
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <Hole size={9} className="mt-2" />
                <span className="text-[0.9375rem] leading-snug">{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[0.8125rem] leading-relaxed text-rind">
            Upgrade any time, including during the event. Buying a bigger plan
            raises the limit immediately and extends how long the photos are
            kept.
          </p>
        </aside>
      </div>
    </div>
  );
}
