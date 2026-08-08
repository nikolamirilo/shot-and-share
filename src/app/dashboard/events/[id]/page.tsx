import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppearanceForm } from "@/app/dashboard/events/[id]/appearance-form";
import { ArchivePanel } from "@/app/dashboard/events/[id]/archive-panel";
import { DangerZone } from "@/app/dashboard/events/[id]/danger-zone";
import { HostGallery } from "@/app/dashboard/events/[id]/host-gallery";
import { SettingsForm } from "@/app/dashboard/events/[id]/settings-form";
import { SharePanel } from "@/app/dashboard/events/[id]/share-panel";
import { UpgradePanel } from "@/app/dashboard/events/[id]/upgrade-panel";
import { TabPanel, Tabs, type TabItem } from "@/components/tabs";
import { Badge, ButtonLink, Eyebrow, Hole, ProgressBar } from "@/components/ui";
import type { EventRow, MediaRow } from "@/lib/db/types";
import { env } from "@/lib/env";
import { getActiveShareToken, storageSummary, toMediaViews } from "@/lib/events";
import {
  describeRetention,
  formatBytes,
  formatEventDate,
  pluralise,
} from "@/lib/format";
import { coerceLayout } from "@/lib/gallery";
import { createClient } from "@/lib/supabase/server";
import { getTier } from "@/lib/tiers";
import { shareUrl } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * The console, in the order a host meets it: get the code onto a table, buy
 * more room if the night needs it, look at what arrived, dress the page up,
 * then the settings and the ending.
 *
 * Each id is the id of its panel, so `#upgrade` still lands on the plan even
 * though that panel is now behind a tab. One group is open at a time at every
 * width: a strip across the top on a phone, a rail down the side of the panel
 * on a laptop - see `Tabs`.
 */
const TABS: TabItem[] = [
  { id: "share", label: "Share" },
  { id: "upgrade", label: "Plan" },
  { id: "photos", label: "Photos" },
  { id: "page", label: "Event page" },
  { id: "settings", label: "Settings" },
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

  const [{ data: stats }, { data: mediaRows }, active] = await Promise.all([
    supabase.rpc("event_stats", { p_event: event.id }),
    supabase
      .from("media")
      .select("*")
      .eq("event_id", event.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(120),
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
  const summary = storageSummary(event);
  const tier = getTier(event.tier);
  const link = active ? shareUrl(env.siteUrl, active.token) : null;

  /**
   * The number that predicts whether the product works. A guest who opens the
   * link and does not upload is the clearest signal of a broken experience, so
   * it is on the host's page, not buried in an analytics tool.
   */
  const conversion =
    event.link_opens > 0
      ? Math.min(
          100,
          Math.round((Number(counts.uploader_count) / event.link_opens) * 100),
        )
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10">
      <Link
        href="/dashboard"
        className="inline-block py-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind hover:underline"
      >
        ← All events
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 sm:mt-6">
        <div className="min-w-0">
          <Eyebrow>{formatEventDate(event.event_date)}</Eyebrow>
          <h1 className="mt-2 text-[2.125rem] xs:text-[2.5rem] sm:text-h1">
            {event.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gouda">{tier.name}</Badge>
          {event.keep_forever && <Badge tone="dark">Kept forever</Badge>}
          {event.status === "expired" && <Badge tone="outline">Paused</Badge>}
        </div>
      </header>

      {/* Both notices used to say "below", which was true when the page was
          one column of everything. One tab is open at a time now, so they name
          the tab instead. */}
      {purchase && (
        <Notice>
          Payment received. If the plan still looks the same, give the provider
          a few seconds - the upgrade lands when their webhook does, not when
          your browser comes back.
        </Notice>
      )}

      {event.status === "expired" && (
        <Notice>
          The storage window for this event has ended.{" "}
          <strong>Nothing has been deleted.</strong> Restore it under Settings,
          or add The Cellar to keep the photos permanently.
        </Notice>
      )}

      <Tabs
        items={TABS}
        label="Event sections"
        desktop="rail"
        sticky
        className="mt-6 sm:mt-7"
        /* The strip runs to both edges of a phone, where it is a bar pinned
           across the screen. The rail is a column inside the page and stops
           where the page does. */
        tablistClassName="-mx-4 px-4 sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0"
      >
        <TabPanel
          id="share"
          display="grid"
          className="mt-5 gap-4 sm:mt-6 sm:gap-6 lg:mt-0 xl:grid-cols-[1.1fr_1fr]"
        >
          <SharePanel
            eventId={event.id}
            link={link}
            brandedQr={tier.brandedQr}
            revoked={!active}
          />

          <section className="card p-5 sm:p-6">
            <h2 className="text-h3">How it is going</h2>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
              <Stat label="Photos" value={total.toLocaleString("en-GB")} />
              <Stat
                label="People who uploaded"
                value={Number(counts.uploader_count).toLocaleString("en-GB")}
              />
              <Stat
                label="Link opened"
                value={pluralise(event.link_opens, "time")}
              />
              <Stat
                label="Opened then uploaded"
                value={conversion === null ? "-" : `${conversion}%`}
                hint={
                  conversion === null
                    ? "No opens yet"
                    : conversion < 40
                      ? "Low. Check the code is easy to reach."
                      : "Healthy"
                }
              />
            </dl>

            <div className="mt-7">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
                  Storage
                </span>
                <span className="text-[0.8125rem] text-crust">
                  {formatBytes(summary.used)} of {formatBytes(summary.quota, 0)}
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar
                  percent={summary.percent}
                  tone={summary.percent >= 85 ? "warn" : "dark"}
                />
              </div>
              <p className="mt-2 flex items-start gap-2 text-[0.8125rem] leading-snug text-crust">
                <Hole size={8} className="mt-1.5" />
                {event.keep_forever
                  ? "Kept forever. This event is never deleted."
                  : describeRetention(event.expires_at)}
              </p>
            </div>

            {tier.slideshow && (
              <ButtonLink
                href={`/dashboard/events/${event.id}/slideshow`}
                variant="secondary"
                className="mt-6 w-full"
              >
                Open the live slideshow
              </ButtonLink>
            )}
          </section>
        </TabPanel>

        {/* The two-column rows split at `xl`, not `lg`: the rail takes 15rem
            out of the width, so at exactly `lg` a pair of columns is narrower
            than either panel reads well at. */}
        <TabPanel
          id="upgrade"
          display="grid"
          className="mt-5 gap-4 sm:mt-6 sm:gap-6 lg:mt-0 xl:grid-cols-[1.1fr_1fr]"
        >
          <ArchivePanel eventId={event.id} photoCount={total} />
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
              <p className="text-[0.8125rem] text-crust">
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
            locked={!tier.customPage}
            shareLink={link}
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

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
        {label}
      </dt>
      <dd
        className="mt-1 font-display text-[1.75rem] font-extrabold leading-none tracking-[-0.04em] sm:text-[1.9375rem]"
        style={{ fontStretch: "86%" }}
      >
        {value}
      </dd>
      {hint && <p className="mt-1 text-[0.8125rem] text-crust">{hint}</p>}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-[1.25rem] border-2 border-pepper bg-gouda p-4 sm:mt-6 sm:p-5">
      <p className="text-[0.9375rem] leading-relaxed">{children}</p>
    </div>
  );
}
