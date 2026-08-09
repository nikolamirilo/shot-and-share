import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Slideshow } from "@/components/dashboard/slideshow";
import type { EventRow, MediaRow } from "@/lib/db/types";
import { toMediaViews } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { getTier } from "@/lib/tiers";

export const metadata: Metadata = { title: "Live slideshow" };
export const dynamic = "force-dynamic";

export default async function SlideshowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const event = data as EventRow;

  if (!getTier(event.tier).slideshow) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-5 sm:py-20">
        <h1 className="text-[2.25rem] sm:text-h1">The slideshow is on Wheel</h1>
        <p className="mt-4 text-body text-crust">
          It runs full screen on a laptop plugged into a projector and adds each
          photo as it arrives. No venue software, no special hardware.
        </p>
        <Link
          href={`/dashboard/events/${event.id}`}
          className="mt-8 inline-block font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind underline"
        >
          ← Back to the event
        </Link>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("media")
    .select("*")
    .eq("event_id", event.id)
    .eq("status", "ready")
    // The slideshow is the party looking at itself. A cover the host uploaded
    // is not part of that - see migration 0013.
    .eq("source", "guest")
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <Slideshow
      eventId={event.id}
      eventName={event.name}
      initial={await toMediaViews((rows ?? []) as MediaRow[])}
    />
  );
}
