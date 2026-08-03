import { Badge, ButtonLink, Hole, cx } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { KEEP_FOREVER, TIER_ORDER, TIERS, approxPhotos } from "@/lib/tiers";

/**
 * Three plans plus one add-on. The middle plan sits in Gouda, which is the only
 * place the pricing section spends colour.
 *
 * We are slightly cheaper than the benchmark and dramatically more generous.
 * The discount is visible at checkout and the value gap makes a side-by-side
 * comparison one-sided. Competing on price alone would be the wrong move: this
 * is a line item next to a wedding that costs tens of thousands, and cheap
 * reads as a hobby project rather than something you trust with the only copy
 * of your photos.
 */

function featureList(tierId: (typeof TIER_ORDER)[number]): string[] {
  const t = TIERS[tierId];
  const retention =
    t.retentionDays >= 365
      ? "12 months"
      : t.retentionDays >= 180
        ? "6 months"
        : `${t.retentionDays} days`;

  return [
    `${formatBytes(t.quotaBytes, 0)} of storage, about ${approxPhotos(t.quotaBytes).toLocaleString("en-GB")} photos`,
    "Unlimited guests",
    `Photos kept for ${retention}`,
    t.video ? "Video, up to 200 MB a clip" : "Photos only",
    "Bulk ZIP download",
    t.brandedQr
      ? "Branded, print-ready QR card"
      : "Clean QR code, no watermark",
    ...(t.customPage ? ["Custom event page"] : []),
    ...(t.slideshow ? ["Live slideshow at the venue"] : []),
    ...(t.albums ? ["Multiple albums"] : []),
    ...(t.prioritySupport ? ["Priority support"] : []),
  ];
}

export function PricingTable({
  ctaHref = "/login",
  ctaLabel = "Create an event",
}: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        {TIER_ORDER.map((id) => {
          const tier = TIERS[id];
          const highlighted = id === "event";

          return (
            <article
              key={id}
              className={cx(
                "flex flex-col rounded-[1.25rem] border-2 border-pepper p-6",
                highlighted
                  ? "bg-gouda shadow-[7px_7px_0_var(--color-pepper)] md:-mt-3 md:mb-3"
                  : "bg-cream",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-h3">{tier.name}</h3>
                {highlighted && <Badge tone="dark">Most events</Badge>}
              </div>
              <p className="mt-1 text-[0.9375rem] text-crust">{tier.meaning}</p>

              <p className="mt-5 flex items-baseline gap-2">
                <span
                  className="font-display text-[2.75rem] font-extrabold leading-none tracking-[-0.045em]"
                  style={{ fontStretch: "86%" }}
                >
                  {tier.priceEur === 0 ? "Free" : `€${tier.priceEur}`}
                </span>
                {tier.priceEur > 0 && (
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
                    once, per event
                  </span>
                )}
              </p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {featureList(id).map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Hole size={9} className="mt-2" />
                    <span className="text-[0.9375rem] leading-snug">{line}</span>
                  </li>
                ))}
              </ul>

              <ButtonLink
                href={ctaHref}
                variant={highlighted ? "secondary" : "primary"}
                className="mt-6 w-full"
              >
                {tier.priceEur === 0 ? "Start free" : ctaLabel}
              </ButtonLink>
            </article>
          );
        })}
      </div>

      <div className="mt-5 rounded-[1.25rem] border-2 border-dashed border-rind bg-cream/70 p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div>
          <div className="flex items-baseline gap-3">
            <h3 className="text-h3">{KEEP_FOREVER.name}</h3>
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
              add-on
            </span>
          </div>
          <p className="mt-1 max-w-lg text-[0.9375rem] text-crust">
            {KEEP_FOREVER.meaning} Add it to any event and the photos stay
            permanently. Paid once, never again — not every year.
          </p>
        </div>
        <p
          className="mt-4 font-display text-[2.75rem] font-extrabold leading-none tracking-[-0.045em] sm:mt-0"
          style={{ fontStretch: "86%" }}
        >
          €{KEEP_FOREVER.priceEur}
        </p>
      </div>
    </div>
  );
}
