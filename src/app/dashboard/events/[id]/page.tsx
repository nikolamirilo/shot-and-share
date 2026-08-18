import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MdArrowBackIosNew,
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
import { StoragePanel } from "@/components/dashboard/storage-panel";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { Alert, Badge, ButtonLink, Eyebrow, Stat } from "@/components/ui";
import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";
import { findEventName } from "@/lib/db/event-repo";
import { formatEventDate } from "@/lib/format";
import { coerceLayout } from "@/lib/gallery";
import { createClient } from "@/lib/supabase/server";
import { KEEP_FOREVER } from "@/lib/tiers";
import { loadEventConsole } from "@/lib/views/event-console";

export const dynamic = "force-dynamic";

/**
 * The console, in the order a host meets it: get the code onto a table, look at
 * what arrived, dress the page up, buy more room if the night needs it, then
 * the settings and the ending.
 *
 * Five, not six, because the bar wants an odd number: one button is raised out
 * of the middle and the rest divide evenly around it - see `Tabs`.
 *
 * Each id is the id of its panel, so `#upgrade` still lands on the plan even
 * though that panel is behind a tab.
 */
const TABS: TabItem[] = [
  {
    id: "share",
    label: "Share",
    short: "Share",
    icon: <MdOutlineQrCode2 />,
    raised: true,
  },
  {
    id: "photos",
    label: "Photos",
    short: "Photos",
    icon: <MdOutlinePhotoLibrary />,
  },
  { id: "page", label: "Event page", short: "Page", icon: <MdOutlinePalette /> },
  {
    id: "upgrade",
    label: "Plan",
    short: "Plan",
    icon: <MdOutlineWorkspacePremium />,
  },
  {
    id: "settings",
    label: "Settings",
    short: "Settings",
    icon: <MdOutlineSettings />,
  },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const name = await findEventName(await createClient(), id);
  return { title: name ?? "Event" };
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

  const view = await loadEventConsole(id);
  if (!view) notFound();

  const { event, tier, summary, media, covers, photoCount } = view;

  return (
    /* The bottom padding is the bar's own height plus room to breathe. Without
       it the last thing on every panel sits underneath the navigation. */
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-5 sm:py-10 sm:pb-10">
      {/* Below xs the header has no room for "My events", and the mark goes to
          the front of the site rather than the dashboard, so this is the way
          back out of an event on a phone. That makes it a control rather than a
          caption, and it is sized like one. */}
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
          or add {KEEP_FOREVER.name} to keep the photos permanently.
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
           no margin. From `sm` it is a strip that runs to both edges of the
           page, and at `lg` a rail that stops where the page does. */
        tablistClassName="sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0"
      >
        {/* The code and the ZIP are the two ends of the same errand - hand the
            link out, take everything home afterwards - so they stack. */}
        <TabPanel
          id="share"
          className="mt-5 space-y-4 sm:mt-6 sm:space-y-6 lg:mt-0"
        >
          <SharePanel
            eventId={event.id}
            link={view.shareLink}
            brandedQr={tier.brandedQr}
            revoked={view.shareLink === null}
            opens={event.link_opens}
            uploaders={view.uploaderCount}
          />

          <ArchivePanel eventId={event.id} photoCount={photoCount} />
        </TabPanel>

        <TabPanel id="photos" className="mt-5 sm:mt-6 lg:mt-0">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div>
              <Eyebrow>Gallery</Eyebrow>
              <h2 className="mt-2 text-[1.625rem] sm:text-h2">
                {photoCount === 0
                  ? "Waiting for the first photo"
                  : "Everything so far"}
              </h2>
            </div>
            {tier.slideshow && (
              <ButtonLink
                href={`/dashboard/events/${event.id}/slideshow`}
                variant="secondary"
                size="sm"
              >
                Open the live slideshow
              </ButtonLink>
            )}
          </div>

          {/* What arrived, over the thing that arrived. Two numbers rather than
              a panel: the gallery underneath is the real answer. */}
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:max-w-md">
            <Stat label="Photos" value={photoCount.toLocaleString("en-GB")} />
            <Stat
              label="People who uploaded"
              value={view.uploaderCount.toLocaleString("en-GB")}
            />
          </dl>

          {media.length < photoCount && (
            <p className="mt-4 text-[0.8125rem] text-ash">
              Showing the {media.length} most recent of {photoCount}.
            </p>
          )}

          <div className="mt-6">
            <HostGallery
              eventId={event.id}
              media={media}
              shareLink={view.shareLink}
              eventLayout={coerceLayout(event.gallery_layout)}
            />
          </div>
        </TabPanel>

        <TabPanel id="page" className="mt-5 sm:mt-6 lg:mt-0">
          <AppearanceForm
            event={event}
            media={media}
            covers={covers}
            photoCount={photoCount}
            maxFileBytes={tier.maxFileBytes}
            remainingBytes={summary.remaining}
            locked={!tier.customPage}
          />
        </TabPanel>

        {/* The meter above the price of more of it. */}
        <TabPanel
          id="upgrade"
          className="mt-5 space-y-4 sm:mt-6 sm:space-y-6 lg:mt-0"
        >
          <StoragePanel event={event} summary={summary} />
          <UpgradePanel
            eventId={event.id}
            tier={event.tier}
            keepForever={event.keep_forever}
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
