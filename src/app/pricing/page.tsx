import type { Metadata } from "next";
import { MdOutlineAddCircleOutline } from "react-icons/md";

import { ComparisonTable } from "@/components/marketing/ComparisonTable";
import { PricingDetail } from "@/components/marketing/PricingDetail";
import { PricingTable } from "@/components/marketing/PricingTable";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { JsonLd } from "@/components/seo/JsonLd";
import { hasSupabase } from "@/lib/env";
import { KEEPING, TIERS, VAT_NOTE, photoCountLabel } from "@/lib/tiers";
import { breadcrumbSchema, graph, softwareApplicationSchema } from "@/lib/seo";
import { getSessionUser, headerUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pricing",
  description: `One payment per event. A free plan that holds about ${photoCountLabel(TIERS.free.quotaBytes)} photos, and keeping them online afterwards from €${KEEPING.plus.priceEur} a year.`,
  alternates: { canonical: "/pricing" },
};

/** The fine print under the table, split so none of it reads as a wall. */
const NOTES: Array<[string, string]> = [
  [
    "VAT at checkout",
    `${VAT_NOTE} Our payment provider is the merchant of record, so they charge the VAT and it appears on the receipt they send you.`,
  ],
  [
    "Nothing renews",
    "Every plan is a single payment for a single event, and no plan is hidden behind a sales call.",
  ],
  [
    "The one recurring charge",
    "Keeping the photos online after your window ends - you choose it, it starts only when that window actually runs out, and cancelling always leaves the year you paid for standing.",
  ],
];

export default async function PricingPage() {
  const user = hasSupabase ? await getSessionUser() : null;

  return (
    <>
      <JsonLd
        id="ld-pricing"
        json={graph(
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
        )}
      />

      <SiteHeader user={headerUser(user)} />

      <main>
        <section className="bg-linen">
          <div className="mx-auto max-w-6xl px-4 py-11 sm:px-5 sm:py-14 lg:py-20">
            <Eyebrow>Pricing</Eyebrow>
            <h1 className="mt-3 max-w-3xl text-[2.375rem] xs:text-[2.75rem] sm:text-[4rem]">
              One payment, per event.
            </h1>
            <p className="mt-5 max-w-2xl text-body text-ash sm:text-lead">
              People plan one wedding, not twelve, so the plans are bought once
              and none of them renew. The only thing that recurs is optional:
              when your window runs out you can keep the photos online for a few
              euros a year instead of downloading them and letting them go.
            </p>

            <div className="mt-9 sm:mt-12">
              <PricingTable
                ctaHref={user ? "/dashboard/events/new" : "/signup"}
              />
            </div>

            <dl className="mt-9 grid gap-x-8 gap-y-6 sm:mt-11 sm:grid-cols-3">
              {NOTES.map(([label, body]) => (
                <div key={label} className="border-t border-edge pt-4">
                  <dt className="eyebrow">{label}</dt>
                  <dd className="mt-2 text-small leading-relaxed text-ash">
                    {body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <ComparisonTable />
        <PricingDetail />

        <section className="bg-claret text-chalk">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-5 px-4 py-8 sm:px-5 sm:py-9">
            <div className="min-w-0 flex-[1_1_20rem]">
              <h2 className="text-[1.875rem] [word-spacing:0.1em] sm:text-[2.5rem]">
                Try it before you pay for it.
              </h2>
              <p className="mt-2 max-w-xl text-small text-chalk/75">
                The free plan is a working product, not a demo. Clean QR code,
                bulk download, unlimited guests, one event at a time. Upgrade
                when you know it works.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
              <ButtonLink
                href={user ? "/dashboard/events/new" : "/signup"}
                size="lg"
                variant="onDark"
                className="w-full sm:w-auto"
              >
                <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
                Create an event
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
