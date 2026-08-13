import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Slideshow } from "@/components/dashboard/slideshow";
import { findEvent } from "@/lib/db/event-repo";
import { listGuestMedia } from "@/lib/db/media-repo";
import { toMediaViews } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { getTier } from "@/lib/tiers";

export const metadata: Metadata = { title: "Live slideshow" };
export const dynamic = "force-dynamic";

/** How many photographs the slideshow starts with; Realtime adds the rest. */
const SLIDESHOW_SEED = 60;

export default async function SlideshowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const event = await findEvent(supabase, id);
  if (!event) notFound();

  if (!getTier(event.tier).slideshow) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-5 sm:py-20">
        <h1 className="text-[2.25rem] sm:text-h1">The slideshow is on Reel</h1>
        <p className="mt-4 text-body text-ash">
          It runs full screen on a laptop plugged into a projector and adds each
          photo as it arrives. No venue software, no special hardware.
        </p>
        <Link
          href={`/dashboard/events/${event.id}`}
          className="mt-8 inline-block font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist underline"
        >
          ← Back to the event
        </Link>
      </div>
    );
  }

  const rows = await listGuestMedia(supabase, event.id, SLIDESHOW_SEED);

  return (
    <Slideshow
      eventId={event.id}
      eventName={event.name}
      initial={await toMediaViews(rows)}
    />
  );
}
