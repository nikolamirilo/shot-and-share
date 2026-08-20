import type { Metadata } from "next";
import { MdOutlineAddCircleOutline } from "react-icons/md";

import { ComparisonTable } from "@/components/marketing/comparison-table";
import { PricingDetail } from "@/components/marketing/pricing-detail";
import { PricingTable } from "@/components/marketing/pricing-table";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { JsonLd } from "@/components/seo/json-ld";
import { hasSupabase } from "@/lib/env";
import { KEEP_FOREVER, TIERS, photoCountLabel } from "@/lib/tiers";
import { breadcrumbSchema, graph, softwareApplicationSchema } from "@/lib/seo";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pricing",
  // Built from the tier table rather than typed, for the same reason the
  // comparison table now is: this said 250 while the plan cards below it said
  // 150, and a search result that disagrees with the page it opens is the
  // worst place of all to be caught contradicting yourself.
  description: `One payment per event. No subscription. A free plan that holds about ${photoCountLabel(TIERS.free.quotaBytes)} photos, and a €${KEEP_FOREVER.priceEur} add-on that keeps them permanently.`,
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

      <SiteHeader signedIn={Boolean(user)} />

      <main>
        <section className="bg-linen">
          <div className="mx-auto max-w-6xl px-4 py-11 sm:px-5 sm:py-14 lg:py-20">
            <Eyebrow>Pricing</Eyebrow>
            <h1 className="mt-3 max-w-3xl text-[2.375rem] xs:text-[2.75rem] sm:text-[4rem]">
              One payment, per event. Then nothing.
            </h1>
            <p className="mt-5 max-w-2xl text-body text-ash sm:text-lead">
              People plan one wedding, not twelve. Asking someone to remember to
              cancel a subscription afterwards is a bad experience and we are not
              going to build one.
            </p>

            <div className="mt-9 sm:mt-12">
              <PricingTable
                ctaHref={user ? "/dashboard/events/new" : "/login"}
              />
            </div>

            {/* The three sentences a payment reviewer is looking for, in the
                order they check them: the price is real, nothing recurs, and
                somebody named is taking the money. */}
            <p className="mt-6 max-w-2xl text-[0.9375rem] text-ash">
              Prices are in euro and include EU VAT. Our payment provider is the
              merchant of record, so the VAT on your invoice is already handled.
            </p>
            <p className="mt-2 max-w-2xl text-[0.9375rem] text-ash">
              There is no subscription anywhere in this product. Every plan is a
              single payment for a single event, nothing renews, and there is
              nothing to cancel. No plan is hidden behind a sales call.
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
            <ButtonLink
              href={user ? "/dashboard/events/new" : "/login"}
              size="lg"
              className="mt-8 w-full sm:w-auto"
            >
              <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
              Create an event
            </ButtonLink>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * The comparison against the obvious alternative. Every line here is a fact
 * about published pricing, which is the only kind of comparison worth making.
 */
