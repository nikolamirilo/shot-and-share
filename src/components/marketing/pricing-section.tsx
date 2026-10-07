import { PlanFinder } from "@/components/marketing/plan-finder";
import { Badge, Eyebrow } from "@/components/ui";
import { VAT_BADGE, VAT_NOTE } from "@/lib/tiers";

export function PricingSection({ ctaHref = "/login" }: { ctaHref?: string }) {
  return (
    <section id="pricing" className="bg-paper">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-5 sm:pb-20 sm:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="mt-3 text-[2.25rem] [word-spacing:0.1em] sm:text-h1">
              Pay once per event. Or not at all.
            </h2>
            <p className="mt-3 max-w-xl text-body text-ash">
              No subscription. Nothing renews and there is nothing to cancel.
            </p>
          </div>
          <Badge tone="outline">{VAT_BADGE}</Badge>
        </div>

        <div className="mt-8 sm:mt-10">
          <PlanFinder ctaHref={ctaHref} />
        </div>

        {/* No "talk to us" line: every price is on the page and nothing here
            asks anyone to negotiate. */}
        <p className="mt-6 text-[0.9375rem] text-ash">
          {VAT_NOTE} Payments are handled by Creem as merchant of record.
        </p>
      </div>
    </section>
  );
}
