import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Slideshow } from "@/components/dashboard/slideshow";
import { requireUser } from "@/lib/actions/guards";
import { findEvent } from "@/lib/db/event-repo";
import { listGuestPage } from "@/lib/db/media-repo";
import { toMediaViews } from "@/lib/events";
import { TIERS, getTier } from "@/lib/tiers";

export const metadata: Metadata = { title: "Live slideshow" };
export const dynamic = "force-dynamic";

/**
 * Enough for the wall to start on, not the evening.
 *
 * The rest of the event follows from the browser a moment later - see the
 * backfill in `Slideshow` - because a host who opens the slideshow at midnight
 * should not sit through a server rendering three hundred photographs before
 * the first one appears.
 */
const SLIDESHOW_SEED = 60;

/**
 * Outside `(shell)`, so there is no header and no footer over the picture.
 * Signing in is therefore this page's own job rather than a layout's.
 */
export default async function SlideshowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const event = await findEvent(supabase, id);
  if (!event) notFound();

  if (!getTier(event.tier).slideshow) {
    return (
      <div className="grid min-h-dvh place-items-center bg-linen px-4 py-16 sm:px-5">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-[2.25rem] sm:text-h1">
            The slideshow is on {TIERS.pro.name}
          </h1>
          <p className="mt-4 text-body text-ash">
            It runs full screen on a laptop plugged into a projector and adds
            each photo as it arrives. No venue software, no special hardware.
          </p>
          <Link
            href={`/dashboard/events/${event.id}`}
            className="mt-8 inline-block font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist underline"
          >
            ← Back to the event
          </Link>
        </div>
      </div>
    );
  }

  /*
   * The same query the gallery and the backfill page through. Approved only,
   * and this is the seed rather than an afterthought: a held photograph on the
   * first frame is on the wall in front of everybody before the host has looked
   * at it, which is the entire point of holding it.
   *
   * `nextCursor` is what the wall goes back through: null means the seed is
   * already the whole event and there is nothing to fetch.
   */
  const { rows, nextCursor } = await listGuestPage(supabase, {
    eventId: event.id,
    pageSize: SLIDESHOW_SEED,
  });

  return (
    <Slideshow
      eventId={event.id}
      eventName={event.name}
      backHref={`/dashboard/events/${event.id}`}
      initial={await toMediaViews(rows)}
      olderThan={nextCursor}
    />
  );
}
