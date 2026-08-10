import Link from "next/link";

import { PricingTable } from "@/components/marketing/pricing-table";
import { Badge, Eyebrow } from "@/components/ui";

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
              No subscription. Buy the size you need for the day, and add The
              Archive later if you want the photos kept permanently.
            </p>
          </div>
          <Badge tone="outline">VAT handled at checkout</Badge>
        </div>

        <div className="mt-8 sm:mt-10">
          <PricingTable />
        </div>

        <p className="mt-6 text-[0.9375rem] text-ash">
          Wedding photographer running fifteen events a year?{" "}
          <Link href="mailto:hello@shotandshare.co" className="underline">
            Talk to us
          </Link>{" "}
          - a plan for you is next.
        </p>
      </div>
    </section>
  );
}
