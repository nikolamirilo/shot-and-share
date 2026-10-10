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

import { AppearanceForm } from "@/components/dashboard/appearance/appearance-form";
import { ArchivePanel } from "@/components/dashboard/archive-panel";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { EventAdminView } from "@/components/dashboard/event-admin-view";
import { PurchaseBanner } from "@/components/dashboard/purchase-banner";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { SharePanel } from "@/components/dashboard/share-panel";
import { StoragePanel } from "@/components/dashboard/storage-panel";
import { UpgradePanel } from "@/components/dashboard/upgrade-panel";
import { Alert, Badge, ButtonLink, Stat } from "@/components/ui";
import { TabPanel, Tabs, type TabItem } from "@/components/ui/tabs";
import { findEventName } from "@/lib/db/event-repo";
import { formatBytes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { KEEPING_NAME, PURCHASABLE_IDS, TIERS, isKeepingProduct } from "@/lib/tiers";
import { recoverPurchases } from "@/lib/payments/recover";
import { getSessionUser } from "@/lib/supabase/server";
import { loadEventConsole } from "@/lib/views/event-console";

export const dynamic = "force-dynamic";

/**
 * The console, in the order a host meets it: get the code onto a table, look at
 * the event itself, dress the page up, buy more room if the night needs it,
 * then the settings and the ending.
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

  /*
   * Coming back from checkout, verify rather than wait.
   *
   * The webhook is still the only thing that grants an entitlement, and it
   * usually beats the browser back here by seconds. When it does not - it was
   * slow, it was lost, the deployment was restarting - this asks the provider
   * whether the order exists and applies it through the same code path. The
   * alternative is the customer refreshing a page that never changes, which is
   * how "I paid and got nothing" becomes a chargeback.
   *
   * Only on the return from checkout, never on an ordinary page load: it is an
   * outbound API call and every other visit has nothing to find.
   */
  if (purchase === "complete") {
    const user = await getSessionUser();
    const { applied } = await recoverPurchases(view.event, user?.email);
    if (applied > 0) {
      view = (await loadEventConsole(id)) ?? view;
    }
  }

  const { event, tier, summary, media, covers, photoCount, review } = view;

  /*
   * Has the thing they just paid for actually arrived?
   *
   * Answered off the plan on the row rather than off whether recovery applied
   * anything just now: the webhook usually gets here first, and "recovery found
   * nothing to do" is what success looks like when it does.
   *
   * `null` where the URL does not name a product - a checkout link issued
   * before this started naming one - and the banner then keeps its old advice
   * rather than guessing.
   */
  const bought = PURCHASABLE_IDS.find((id) => id === product);
  const settled =
    bought === undefined
      ? null
      : isKeepingProduct(bought)
        ? view.keptYears > 0
        : tier.rank >= TIERS[bought as "plus" | "pro"].rank;

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
            revoked={view.shareLink === null}
            opens={event.link_opens}
            uploaders={view.uploaderCount}
          />

          <ArchivePanel eventId={event.id} photoCount={photoCount} />
        </TabPanel>

        {/* The page itself, with the host's own powers on it. Everything that
            changes it is one tab along, under Edit. */}
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

        {/* What the event has used, the meter, and the price of more of it -
            one thought, in that order. */}
        <TabPanel
          id="upgrade"
          className="mt-5 space-y-4 sm:mt-6 sm:space-y-6 lg:mt-0"
        >
          {/* Numbers rather than a panel. All four come from one `event_stats`
              call the page was already making. Photographs and clips are
              separate because they are not interchangeable to a host - one is
              the wall, the other is the speeches - and a single total hid the
              difference. */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:max-w-xl sm:grid-cols-4">
            <Stat label="Photos" value={view.photos.toLocaleString("en-GB")} />
            <Stat label="Videos" value={view.videos.toLocaleString("en-GB")} />
            <Stat
              label="Guests"
              value={view.uploaderCount.toLocaleString("en-GB")}
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
