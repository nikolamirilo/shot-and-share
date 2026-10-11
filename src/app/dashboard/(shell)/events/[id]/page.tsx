import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MdArrowBackIosNew,
  MdOutlineEdit,
  MdOutlinePhotoLibrary,
  MdOutlineQrCode2,
  MdOutlineSettings,
  MdOutlineWorkspacePremium,
} from "react-icons/md";

import { AppearanceForm } from "@/components/dashboard/appearance/AppearanceForm";
import { ArchivePanel } from "@/components/dashboard/ArchivePanel";
import { DangerZone } from "@/components/dashboard/DangerZone";
import { EventAdminView } from "@/components/dashboard/EventAdminView";
import { PurchaseBanner } from "@/components/dashboard/PurchaseBanner";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { SharePanel } from "@/components/dashboard/SharePanel";
import { StoragePanel } from "@/components/dashboard/StoragePanel";
import { UpgradePanel } from "@/components/dashboard/UpgradePanel";
import { Alert, Badge, ButtonLink, Stat } from "@/components/ui";
import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";
import { findEventName } from "@/lib/db/event-repo";
import { formatBytes } from "@/utils/format";
import { createClient } from "@/lib/supabase/server";
import { KEEPING_NAME, PURCHASABLE_IDS, TIERS, isKeepingProduct } from "@/lib/tiers";
import { recoverPurchases } from "@/lib/payments/recover";
import { getSessionUser } from "@/lib/supabase/server";
import { loadEventConsole } from "@/lib/views/event-console";
import { formatCount } from "@/utils/format";

export const dynamic = "force-dynamic";

const TABS: TabItem[] = [
  {
    id: "share",
    label: "Share",
    short: "Share",
    icon: <MdOutlineQrCode2 />,
    raised: true,
  },
  {
    id: "event",
    label: "Event",
    short: "Event",
    icon: <MdOutlinePhotoLibrary />,
  },
  { id: "edit", label: "Edit", short: "Edit", icon: <MdOutlineEdit /> },
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
  searchParams: Promise<{ purchase?: string; product?: string }>;
}) {
  const { id } = await params;
  const { purchase, product } = await searchParams;

  let view = await loadEventConsole(id);
  if (!view) notFound();

  if (purchase === "complete") {
    const user = await getSessionUser();
    const { applied } = await recoverPurchases(view.event, user?.email);
    if (applied > 0) {
      view = (await loadEventConsole(id)) ?? view;
    }
  }

  const { event, tier, summary, media, covers, photoCount, review } = view;

  const bought = PURCHASABLE_IDS.find((id) => id === product);
  const settled =
    bought === undefined
      ? null
      : isKeepingProduct(bought)
        ? view.keptYears > 0
        : tier.rank >= TIERS[bought as "plus" | "pro"].rank;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-5 sm:py-10 sm:pb-10">
      <ButtonLink href="/dashboard" variant="secondary" size="sm">
        <MdArrowBackIosNew aria-hidden className="shrink-0" /> All events
      </ButtonLink>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 sm:mt-6">
        <div className="min-w-0">
          <h1 className="mt-2 text-[2.125rem] xs:text-[2.5rem] sm:text-h1">
            {event.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {event.keep_forever && <Badge tone="dark">Kept forever</Badge>}
          {event.status === "expired" && <Badge tone="outline">Paused</Badge>}
        </div>
      </header>

      {purchase === "complete" && (
        <PurchaseBanner settled={settled} className="mt-5 sm:mt-6" />
      )}

      {event.status === "expired" && (
        <Alert tone="notice" className="mt-5 sm:mt-6">
          The storage window for this event has ended.{" "}
          <strong>Nothing has been deleted.</strong> Restore it under Settings,
          or start {KEEPING_NAME.toLowerCase()} to keep them online for longer.
        </Alert>
      )}

      <Tabs
        items={TABS}
        label="Event sections"
        desktop="rail"
        mobile="bar"
        sticky
        className="mt-6 sm:mt-7"
        tablistClassName="sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0"
      >
        <TabPanel
          id="share"
          className="mt-5 space-y-4 sm:mt-6 sm:space-y-6 lg:mt-0"
        >
          <SharePanel
            eventId={event.id}
            link={view.shareLink}
            revoked={view.shareLink === null}
            opens={event.link_opens}
            uploaders={view.uploaderCount}
          />

          <ArchivePanel eventId={event.id} photoCount={photoCount} />
        </TabPanel>

        <TabPanel id="event" className="mt-5 sm:mt-6 lg:mt-0">
          <EventAdminView
            event={event}
            appearance={view.appearance}
            media={media}
            review={review}
            photoCount={photoCount}
            shareLink={view.shareLink}
            coverUrl={view.coverUrl}
            coverPreviewUrl={view.coverPreviewUrl}
            slideshow={tier.slideshow}
          />
        </TabPanel>

        <TabPanel id="edit" className="mt-5 sm:mt-6 lg:mt-0">
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

        <TabPanel
          id="upgrade"
          className="mt-5 space-y-4 sm:mt-6 sm:space-y-6 lg:mt-0"
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:max-w-xl sm:grid-cols-4">
            <Stat label="Photos" value={formatCount(view.photos)} />
            <Stat label="Videos" value={formatCount(view.videos)} />
            <Stat
              label="Guests"
              value={formatCount(view.uploaderCount)}
              hint="Phones that uploaded"
            />
            <Stat
              label="Storage"
              value={formatBytes(summary.used)}
              hint={`of ${formatBytes(summary.quota, 0)}`}
            />
          </dl>

          <StoragePanel event={event} summary={summary} />
          <UpgradePanel
            eventId={event.id}
            tier={event.tier}
            keepForever={event.keep_forever}
            keptYears={view.keptYears}
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
