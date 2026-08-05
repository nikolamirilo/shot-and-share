import type { Metadata } from "next";

import { PricingTable } from "@/components/pricing-table";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Badge, ButtonLink, Eyebrow } from "@/components/ui";
import { hasSupabase } from "@/lib/env";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "One payment per event. No subscription. A free plan that holds about 250 photos, and a €29 add-on that keeps them permanently.",
};

export default async function PricingPage() {
  const user = hasSupabase ? await getSessionUser() : null;

  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />

      <main>
        <section className="border-b-2 border-pepper bg-butter">
          <div className="mx-auto max-w-6xl px-5 py-14 lg:py-20">
            <Eyebrow>Pricing</Eyebrow>
            <h1 className="mt-3 max-w-3xl text-h1 sm:text-[4rem]">
              One payment, per event. Then nothing.
            </h1>
            <p className="mt-5 max-w-2xl text-lead text-crust">
              People plan one wedding, not twelve. Asking someone to remember to
              cancel a subscription afterwards is a bad experience and we are not
              going to build one.
            </p>

            <div className="mt-12">
              <PricingTable
                ctaHref={user ? "/dashboard/events/new" : "/login"}
              />
            </div>

            <p className="mt-6 text-[0.9375rem] text-crust">
              Prices include EU VAT handling - our payment provider is the
              merchant of record, so the VAT on your invoice is already sorted.
            </p>
          </div>
        </section>

        <Comparison />
        <Detail />

        <section className="bg-gouda">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center">
            <h2 className="text-h1">Try it before you pay for it.</h2>
            <p className="mx-auto mt-4 max-w-xl text-lead text-crust">
              The free plan is a working product, not a demo. Clean QR code, bulk
              download, unlimited guests. Upgrade when you know it works.
            </p>
            <ButtonLink
              href={user ? "/dashboard/events/new" : "/login"}
              size="lg"
              className="mt-8"
            >
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
function Comparison() {
  const rows: Array<[string, string, string]> = [
    ["Photos on the free plan", "50", "About 250"],
    ["Bulk download when free", "No", "Yes"],
    ["Free QR code", "Watermarked", "Clean"],
    ["Mid tier", "$24.99 for 200 photos, 30 days", "€19 for ~2,500, 6 months"],
    ["Top tier", "$49.99, 90 days", "€39, 12 months"],
    ["Keep photos permanently", "$49 every year", "€29 once"],
  ];

  return (
    <section className="border-b-2 border-pepper bg-pepper text-butter">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <Eyebrow className="text-gouda">Side by side</Eyebrow>
        <h2 className="mt-3 text-h1">
          Slightly cheaper. Dramatically more generous.
        </h2>
        <p className="mt-4 max-w-xl text-[0.9375rem] text-butter/70">
          Compared against the best-known alternative in this category, using
          their published prices.
        </p>

        <div className="mt-9 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-butter/25">
                <th className="py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-butter/55">
                  &nbsp;
                </th>
                <th className="py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-butter/55">
                  Them
                </th>
                <th className="py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-gouda">
                  Us
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, them, us]) => (
                <tr key={label} className="border-b border-butter/12">
                  <td className="py-3.5 pr-4 text-[0.9375rem]">{label}</td>
                  <td className="py-3.5 pr-4 text-[0.9375rem] text-butter/60">
                    {them}
                  </td>
                  <td className="py-3.5 text-[0.9375rem] font-bold text-gouda">
                    {us}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Detail() {
  const points: Array<[string, string]> = [
    [
      "Why gigabytes and not a photo count",
      "A count limit punishes anyone with a recent phone and rewards nobody. Storage is what actually costs money, so that is what we count - and it lets us be far more generous for the same spend.",
    ],
    [
      "Why the free plan is properly usable",
      "You cannot judge this product on fifty photos. The thing you most want to test is what happens when a hundred arrive at once, so the free plan lets you do exactly that.",
    ],
    [
      "Why Keep Forever is not a subscription",
      "A wedding happens once. An annual charge for storage is the wrong shape for it: people forget, cards expire, and one day the photos are gone. €29, paid once, and they stay.",
    ],
    [
      "Why we are not the cheapest",
      "This sits next to a wedding that costs tens of thousands. A price far below the market reads as a hobby project, and this is a product whose entire promise is that it will not lose your memories.",
    ],
  ];

  return (
    <section className="border-b-2 border-pepper bg-butter">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>The reasoning</Eyebrow>
          <Badge tone="outline">No subscription anywhere</Badge>
        </div>

        <div className="mt-9 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {points.map(([title, body]) => (
            <div key={title}>
              <h3 className="text-[1.3rem] font-extrabold tracking-[-0.03em]">
                {title}
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-crust">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
