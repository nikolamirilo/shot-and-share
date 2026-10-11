import type { Metadata } from "next";
import {
  MdOutlineAddCircleOutline,
  MdOutlinePhotoLibrary,
} from "react-icons/md";

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
                ctaHref={user ? "/dashboard/events/new" : "/login"}
              />
            </div>

            <p className="mt-6 max-w-2xl text-[0.9375rem] text-ash">
              {VAT_NOTE} Our payment provider is the merchant of record, so the
              VAT on your invoice is already handled.
            </p>
            <p className="mt-2 max-w-2xl text-[0.9375rem] text-ash">
              Every plan is a single payment for a single event and none of
              them renew. The one recurring charge is keeping the photos online
              after your window ends - you choose it, it starts only when that
              window actually runs out, and cancelling always leaves the year
              you paid for standing. No plan is hidden behind a sales call.
            </p>
          </div>
        </section>

        <ComparisonTable />
        <PricingDetail />

        <section className="bg-blush">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-5 sm:py-20">
            <h2 className="text-[2.25rem] sm:text-h1">
              Try it before you pay for it.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-body text-ash sm:text-lead">
              The free plan is a working product, not a demo. Clean QR code, bulk
              download, unlimited guests. Upgrade when you know it works.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <ButtonLink
                href={user ? "/dashboard/events/new" : "/login"}
                size="lg"
                className="w-full sm:w-auto"
              >
                <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
                Create an event
              </ButtonLink>
              <ButtonLink
                href="/demo"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                <MdOutlinePhotoLibrary aria-hidden className="shrink-0 text-[1.25em]" />
                See a real gallery
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
