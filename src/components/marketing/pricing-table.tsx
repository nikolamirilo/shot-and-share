import Link from "next/link";
import { MdOutlineAddCircleOutline, MdVerifiedUser } from "react-icons/md";

import { Badge, ButtonLink, Hole, cx } from "@/components/ui";
import { formatBytes } from "@/lib/format";
import {
  KEEPING,
  KEEPING_NAME,
  TIER_ORDER,
  TIERS,
  photoCountLabel,
  type PlanKey,
} from "@/lib/tiers";

/**
 * Three plans plus one add-on.
 *
 * One plan is recommended - Plus by default, or whichever the guest-count
 * finder picks - and that plan gets both the lift and the claret button. It
 * used to be the other way round: the highlighted plan had the white button
 * while Free and Pro had claret, so the eye went to the plans nobody was
 * recommending.
 */

/** Who each plan is for, in the words a host would use. */
const FOR: Record<PlanKey, string> = {
  free: "For a dinner or a small party.",
  plus: "For most weddings.",
  pro: "For big weddings and whole weekends.",
};

/**
 * What a plan card lists.
 *
 * Every line is read off a flag in `tiers.ts` that something in the product
 * actually checks. Two were not: "Multiple albums" and "Priority support" were
 * on the Pro card against flags no code anywhere read, so the page was selling
 * two features that did not exist. Against prices quoted VAT-inclusive and
 * final to EU consumers, that is a refund question rather than a copy question.
 *
 * So the rule is the removal: a line here needs a flag, and a flag needs a
 * caller. Adding either one on its own is how it comes back.
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
    ...(t.cleanQr ? ["Clean QR code, no watermark"] : []),
    ...(t.customPage ? ["Custom event page"] : []),
    ...(t.slideshow ? ["Live slideshow at the venue"] : []),
  ];
}

export function PricingTable({
  ctaHref = "/login",
  recommended = "plus",
  badge = "Most weddings",
}: {
  ctaHref?: string;
  /** The plan that gets the lift and the claret button. */
  recommended?: PlanKey;
  /** What the recommended plan's badge says. */
  badge?: string;
}) {
  return (
    <div>
      <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
        {TIER_ORDER.map((planKey) => {
          const tier = TIERS[planKey];
          const highlighted = planKey === recommended;

          return (
            <article
              key={planKey}
              className={cx(
                "flex flex-col rounded-[1.25rem] p-5 sm:p-6",
                // The recommended plan is the one that comes furthest off the
                // page: same trick as before, height instead of a heavier line.
                highlighted
                  ? "bg-blush shadow-lg md:-translate-y-3"
                  : "bg-paper shadow-md",
                "transition-[transform,background-color,box-shadow] duration-500",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-h3">{tier.name}</h3>
                {highlighted && <Badge tone="dark">{badge}</Badge>}
              </div>
              <p className="mt-1 text-[0.9375rem] text-ash">{FOR[planKey]}</p>

              <p className="mt-5 flex items-baseline gap-2">
                <span
                  className="font-display text-[2.75rem] font-extrabold leading-none tracking-[-0.045em]"
                  style={{ fontStretch: "86%" }}
                >
                  €{tier.priceEur}
                </span>
                <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
                  {tier.priceEur === 0 ? "No card" : "once, per event"}
                </span>
              </p>
              {planKey === "plus" && (
                <p className="mt-1.5 text-[0.84rem] text-ash">
                  About the price of one disposable camera.
                </p>
              )}

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
                variant={highlighted ? "primary" : "secondary"}
                className="mt-6 w-full"
              >
                <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
                {tier.priceEur === 0 ? "Start free" : `Get ${tier.name}`}
              </ButtonLink>
            </article>
          );
        })}
      </div>

      {/* The one thing here that is not a plan, and it says so by sitting *in*
          the page while the three plans float above it.

          It is also the only recurring charge in the product, so it says that
          plainly and says when it starts. A yearly fee discovered at renewal
          rather than at purchase is how a photo app gets a reputation. */}
      <div className="inset-shadow-well mt-4 rounded-[1.25rem] bg-ink/5 p-5 sm:mt-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-h3">{KEEPING_NAME}</h3>
            <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
              optional, yearly
            </span>
          </div>
          <p className="mt-1 max-w-lg text-[0.9375rem] text-ash">
            When your plan&apos;s window runs out, keep the photos online
            instead of downloading them. Nothing is charged until that point,
            and you can cancel any time - the year you have paid for always
            stands.
          </p>
        </div>
        <p
          className="mt-4 shrink-0 sm:mt-0"
        >
          <span
            className="font-display text-[2.25rem] font-extrabold leading-none tracking-[-0.045em] sm:text-[2.75rem]"
            style={{ fontStretch: "86%" }}
          >
            €{KEEPING.plus.priceEur}–{KEEPING.pro.priceEur}
          </span>
          <span className="ml-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            a year
          </span>
        </p>
      </div>

      {/* The refund policy is unusually generous, so it does sales work here
          rather than waiting on the legal page. Same promise, same words. */}
      <div className="mt-4 flex items-start gap-4 rounded-[1.25rem] bg-linen p-5 sm:mt-5 sm:p-6">
        <MdVerifiedUser aria-hidden className="mt-0.5 shrink-0 text-[30px] text-pine" />
        <div>
          <p className="font-semibold">14-day refund, no questions asked.</p>
          <p className="mt-0.5 text-[0.9375rem] text-ash">
            And if Shot &amp; Share didn&apos;t work at your event, you get your
            money back even after the event.{" "}
            <Link href="/refund-policy" className="underline underline-offset-2">
              Read the refund policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
