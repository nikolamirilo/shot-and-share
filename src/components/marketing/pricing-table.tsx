import { MdOutlineAddCircleOutline } from "react-icons/md";

import { Badge, ButtonLink, Hole, cx } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import { KEEP_FOREVER, TIER_ORDER, TIERS, photoCountLabel } from "@/lib/tiers";

/**
 * Three plans plus one add-on. The middle plan sits in Gouda, the only place
 * the pricing section spends colour.
 */

function featureList(key: (typeof TIER_ORDER)[number]): string[] {
  const t = TIERS[key];
  const retention =
    t.retentionDays >= 365
      ? "12 months"
      : t.retentionDays >= 180
        ? "6 months"
        : `${t.retentionDays} days`;

  return [
    `${formatBytes(t.quotaBytes, 0)} of storage, about ${photoCountLabel(t.quotaBytes)} photos`,
    "Unlimited guests",
    `Photos kept for ${retention}`,
    t.video
      ? `Video, up to ${formatBytes(t.maxFileBytes, 0)} a clip`
      : "Photos only",
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
      <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
        {TIER_ORDER.map((planKey) => {
          const tier = TIERS[planKey];
          const highlighted = planKey === "plus";

          return (
            <article
              key={planKey}
              className={cx(
                "flex flex-col rounded-[1.25rem] p-5 sm:p-6",
                // The recommended plan is the one that comes furthest off the
                // page: same trick as before, height instead of a heavier line.
                highlighted
                  ? "bg-blush shadow-lg md:-mt-3 md:mb-3"
                  : "bg-paper shadow-md",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-h3">{tier.name}</h3>
                {highlighted && <Badge tone="dark">Most events</Badge>}
              </div>
              <p className="mt-1 text-[0.9375rem] text-ash">{tier.meaning}</p>

              <p className="mt-5 flex items-baseline gap-2">
                <span
                  className="font-display text-[2.75rem] font-extrabold leading-none tracking-[-0.045em]"
                  style={{ fontStretch: "86%" }}
                >
                  {tier.priceEur === 0 ? "Free" : `€${tier.priceEur}`}
                </span>
                {tier.priceEur > 0 && (
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
                    once, per event
                  </span>
                )}
              </p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {featureList(planKey).map((line) => (
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
                <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
                {tier.priceEur === 0 ? "Start free" : ctaLabel}
              </ButtonLink>
            </article>
          );
        })}
      </div>

      {/* The one thing here that is not a plan, and it says so by sitting *in*
          the page while the three plans float above it. */}
      <div className="inset-shadow-well mt-4 rounded-[1.25rem] bg-ink/5 p-5 sm:mt-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-h3">{KEEP_FOREVER.name}</h3>
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
              add-on
            </span>
          </div>
          <p className="mt-1 max-w-lg text-[0.9375rem] text-ash">
            {KEEP_FOREVER.meaning} Add it to any event and the photos stay
            permanently. Paid once, never again - not every year.
          </p>
        </div>
        <p
          className="mt-4 font-display text-[2.25rem] font-extrabold leading-none tracking-[-0.045em] sm:mt-0 sm:text-[2.75rem]"
          style={{ fontStretch: "86%" }}
        >
          €{KEEP_FOREVER.priceEur}
        </p>
      </div>
    </div>
  );
}
