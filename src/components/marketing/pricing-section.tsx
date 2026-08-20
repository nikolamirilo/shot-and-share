import Link from "next/link";

import { PricingTable } from "@/components/marketing/pricing-table";
import { Badge, Eyebrow } from "@/components/ui";
import { KEEP_FOREVER, VAT_BADGE } from "@/lib/tiers";

export function PricingSection() {
  return (
    <section id="pricing" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-5 sm:pb-20 sm:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-3 text-[2.25rem] sm:text-h1">
              Paid once, per event.
            </h2>
            <p className="mt-3 max-w-xl text-body text-ash">
              No subscription. Buy the size you need for the day, and add{" "}
              {/* Named from the constant. This said "The Archive", which is
                  what the add-on used to be called, while the card directly
                  below it said Keep Forever. Two names for one product on one
                  screen. */}
              {KEEP_FOREVER.name} later if you want the photos kept
              permanently.
            </p>
          </div>
          <Badge tone="outline">{VAT_BADGE}</Badge>
        </div>

        <div className="mt-8 sm:mt-10">
          <PricingTable />
        </div>

        {/* This used to invite photographers to write in for a plan of their
            own. A "talk to us" line is the single clearest signal that a
            business sells services rather than software, and it is the thing
            that got this store read as an agency. Every price is on the page
            now, and nothing here asks anyone to negotiate. */}
        <p className="mt-6 text-[0.9375rem] text-ash">
          Every price is on this page. One payment for one event, nothing
          renews, nothing to cancel.{" "}
          <Link href="/pricing" className="underline">
            See what each plan includes
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
