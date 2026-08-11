import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MdArrowBackIosNew,
  MdOutlineBarChart,
  MdOutlinePalette,
  MdOutlinePhotoLibrary,
  MdOutlineQrCode2,
  MdOutlineSettings,
  MdOutlineWorkspacePremium,
} from "react-icons/md";

import { AppearanceForm } from "@/components/dashboard/appearance/appearance-form";
import { ArchivePanel } from "@/components/dashboard/archive-panel";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { HostGallery } from "@/components/dashboard/host-gallery";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { SharePanel } from "@/components/dashboard/share-panel";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { EventStatsPanel } from "@/components/dashboard/event-stats-panel";
import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";
import { Alert, Badge, ButtonLink, Eyebrow } from "@/components/ui";
import type { EventRow, MediaRow } from "@/lib/db/types";
import { env } from "@/lib/env";
import { getActiveShareToken, storageSummary, toMediaViews } from "@/lib/events";
import { formatEventDate } from "@/lib/format";
import { coerceLayout } from "@/lib/gallery";
import { createClient } from "@/lib/supabase/server";
import { getTier } from "@/lib/tiers";
import { shareUrl } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * The console, in the order a host meets it: get the code onto a table and take
 * the photos home again, see how the night is going, buy more room if it needs
 * it, look at what arrived, dress the page up, then the settings and the
 * ending.
 *
 * Each id is the id of its panel, so `#upgrade` still lands on the plan even
 * though that panel is now behind a tab. One group is open at a time at every
 * width: a strip across the top on a phone, a rail down the side of the panel
 * on a laptop - see `Tabs`.
 */
const TABS: TabItem[] = [
  { id: "share", label: "Share", short: "Share", icon: <MdOutlineQrCode2 /> },
  {
    id: "analytics",
    label: "Analytics",
    short: "Stats",
    icon: <MdOutlineBarChart />,
  },
  {
    id: "upgrade",
    label: "Plan",
    short: "Plan",
    icon: <MdOutlineWorkspacePremium />,
  },
  {
    id: "photos",
    label: "Photos",
    short: "Photos",
    icon: <MdOutlinePhotoLibrary />,
  },
  { id: "page", label: "Event page", short: "Page", icon: <MdOutlinePalette /> },
  {
    id: "settings",
    label: "Settings",
    short: "Setup",
    icon: <MdOutlineSettings />,
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.name ?? "Event" };
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ purchase?: string }>;
}) {
  const { id } = await params;
  const { purchase } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const event = data as EventRow;

  const [{ data: stats }, { data: mediaRows }, { data: coverRows }, active] =
    await Promise.all([
      supabase.rpc("event_stats", { p_event: event.id }),
      supabase
        .from("media")
        .select("*")
        .eq("event_id", event.id)
        .eq("status", "ready")
        // Guests only. A cover the host uploaded lives in the same table and
        // the same folder, but it is not a photograph of the party - see
        // migration 0013 - so it belongs in the picker rather than the gallery.
        .eq("source", "guest")
        .order("created_at", { ascending: false })
        .limit(120),
      // The host's own covers, all of them. There are only ever a handful, and
      // they get their own row at the top of the picker so a host can go back
      // to one they uploaded last week.
      supabase
        .from("media")
        .select("*")
        .eq("event_id", event.id)
        .eq("status", "ready")
        .eq("source", "cover")
        .order("created_at", { ascending: false }),
      getActiveShareToken(event.id),
    ]);

  const counts = stats?.[0] ?? {
    photo_count: 0,
    video_count: 0,
    uploader_count: 0,
    bytes: 0,
  };
  const total = Number(counts.photo_count) + Number(counts.video_count);
  const media = await toMediaViews((mediaRows ?? []) as MediaRow[]);
  const covers = await toMediaViews((coverRows ?? []) as MediaRow[]);
  const summary = storageSummary(event);
  const tier = getTier(event.tier);
  const link = active ? shareUrl(env.siteUrl, active.token) : null;

  return (
    /* The bottom padding is the bar's own height plus room to breathe. Without
       it the last thing on every panel sits underneath the navigation, which is
       the one bug a pinned bar always ships with. */
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-5 sm:py-10 sm:pb-10">
      {/* Below xs the header has no room for "My events", and the mark now
          goes to the front of the site rather than to the dashboard, so this
          is the way back out of an event on a phone. That makes it a control
          rather than a caption, and it is sized like one. */}
      <ButtonLink href="/dashboard" variant="secondary" size="sm">
        <MdArrowBackIosNew aria-hidden className="shrink-0" /> All events
      </ButtonLink>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 sm:mt-6">
        <div className="min-w-0">
          <h1 className="mt-2 text-[2.125rem] xs:text-[2.5rem] sm:text-h1">
            {event.name}
          </h1>
          <Eyebrow>{formatEventDate(event.event_date)}</Eyebrow>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {event.keep_forever && <Badge tone="dark">Kept forever</Badge>}
          {event.status === "expired" && <Badge tone="outline">Paused</Badge>}
        </div>
      </header>

      {/* Both notices used to say "below", which was true when the page was
          one column of everything. One tab is open at a time now, so they name
          the tab instead. */}
      {purchase && (
        <Alert tone="notice" className="mt-5 sm:mt-6">
          Payment received. If the plan still looks the same, give the provider
          a few seconds - the upgrade lands when their webhook does, not when
          your browser comes back.
        </Alert>
      )}

      {event.status === "expired" && (
        <Alert tone="notice" className="mt-5 sm:mt-6">
          The storage window for this event has ended.{" "}
          <strong>Nothing has been deleted.</strong> Restore it under Settings,
          or add The Archive to keep the photos permanently.
        </Alert>
      )}

      <Tabs
        items={TABS}
        label="Event sections"
        desktop="rail"
        mobile="bar"
        sticky
        className="mt-6 sm:mt-7"
        /* Below `sm` this is pinned across the bottom of the screen and needs
           no margin of its own. From `sm` it is a strip that runs to both edges
           of the page, and at `lg` a rail that stops where the page does. */
        tablistClassName="sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0"
      >
        {/* The code and the ZIP are the two ends of the same errand - hand the
            link out, take everything home afterwards - so they stack in one
            column, the download under the code rather than beside it. */}
        <TabPanel
          id="share"
          className="mt-5 space-y-4 sm:mt-6 sm:space-y-6 lg:mt-0"
        >
          <SharePanel
            eventId={event.id}
            link={link}
            brandedQr={tier.brandedQr}
            revoked={!active}
          />

          <ArchivePanel eventId={event.id} photoCount={total} />
        </TabPanel>

        <TabPanel id="analytics" className="mt-5 sm:mt-6 lg:mt-0">
          <EventStatsPanel
            event={event}
            photoCount={total}
            uploaderCount={Number(counts.uploader_count)}
            summary={summary}
            slideshow={tier.slideshow}
          />
        </TabPanel>

        <TabPanel id="upgrade" className="mt-5 sm:mt-6 lg:mt-0">
          <UpgradePanel
            eventId={event.id}
            tier={event.tier}
            keepForever={event.keep_forever}
          />
        </TabPanel>

        <TabPanel id="photos" className="mt-5 sm:mt-6 lg:mt-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>Gallery</Eyebrow>
              <h2 className="mt-2 text-[1.625rem] sm:text-h2">
                {total === 0
                  ? "Waiting for the first photo"
                  : "Everything so far"}
              </h2>
            </div>
            {media.length < total && (
              <p className="text-[0.8125rem] text-ash">
                Showing the {media.length} most recent of {total}.
              </p>
            )}
          </div>

          <div className="mt-6">
            <HostGallery
              eventId={event.id}
              media={media}
              shareLink={link}
              eventLayout={coerceLayout(event.gallery_layout)}
            />
          </div>
        </TabPanel>

        {/* These two used to be the two columns of one row on a laptop. Only
            one tab is open at a time now, so there is no row to be columns of
            and they are ordinary siblings. */}
        <TabPanel id="page" className="mt-5 sm:mt-6 lg:mt-0">
          <AppearanceForm
            event={event}
            media={media}
            covers={covers}
            photoCount={total}
            maxFileBytes={tier.maxFileBytes}
            remainingBytes={summary.remaining}
            locked={!tier.customPage}
          />
        </TabPanel>

        <TabPanel
          id="settings"
          className="mt-5 space-y-4 sm:mt-6 sm:space-y-6 lg:mt-0"
        >
          <SettingsForm event={event} />
          <DangerZone event={event} />
        </TabPanel>
      </Tabs>
    </div>
  );
}
