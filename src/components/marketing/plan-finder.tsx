"use client";

import { useState } from "react";

import { PricingTable } from "@/components/marketing/pricing-table";
import { AVG_PHOTO_BYTES, GB, TIERS, TIER_ORDER, type PlanKey } from "@/lib/tiers";

/**
 * "Which plan do I need?" answered with the visitor's own guest count, which
 * is where people stall on a pricing page.
 *
 * Ten photos a guest is the README's own figure (two hundred guests, two
 * thousand photos); the size per photo is the same `AVG_PHOTO_BYTES` the plan
 * cards count with, so the finder and the cards cannot disagree.
 */
const PHOTOS_PER_GUEST = 10;
const MIN = 10;
const MAX = 400;
const nf = new Intl.NumberFormat("en-GB");

export function planFor(guests: number): PlanKey {
  const bytes = guests * PHOTOS_PER_GUEST * AVG_PHOTO_BYTES;
  return TIER_ORDER.find((key) => bytes <= TIERS[key].quotaBytes) ?? "pro";
}

export function PlanFinder({ ctaHref }: { ctaHref?: string }) {
  const [guests, setGuests] = useState(120);
  const photos = guests * PHOTOS_PER_GUEST;
  const plan = planFor(guests);
  const fill = ((guests - MIN) / (MAX - MIN)) * 100;

  return (
    <>
      <div className="grid gap-5 rounded-[1.25rem] bg-linen p-5 inset-shadow-well md:grid-cols-[1.15fr_1fr] md:items-center md:gap-10 md:px-7 md:py-6">
        <div>
          <label htmlFor="guests" className="font-semibold">
            How many guests are coming?
          </label>
          <p className="mt-1 flex items-baseline gap-3">
            <output
              htmlFor="guests"
              className="font-display text-[clamp(2.5rem,2rem+1.6vw,3.5rem)] font-extrabold leading-none tracking-[-0.045em] tabular-nums"
              style={{ fontStretch: "84%" }}
            >
              {nf.format(guests)}
            </output>
            <span className="text-ash">guests</span>
          </p>
          <input
            id="guests"
            type="range"
            min={MIN}
            max={MAX}
            step={5}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            aria-describedby="finder-result"
            className="range-ink mt-3 h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(90deg, var(--color-ink) ${fill}%, var(--color-edge) ${fill}%)`,
            }}
          />
          <div aria-hidden className="mt-2 flex justify-between font-mono text-[0.66rem] tracking-[0.1em] text-mist">
            <span>10</span>
            <span>100</span>
            <span>200</span>
            <span>300</span>
            <span>400</span>
          </div>
        </div>
        <div id="finder-result" aria-live="polite" className="rounded-2xl bg-paper px-4.5 py-4 shadow-sm">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.12em] text-mist tabular-nums">
            ≈ {nf.format(photos)} photos · ≈ {((photos * AVG_PHOTO_BYTES) / GB).toFixed(1)} GB
          </p>
          <p
            className="mt-1.5 font-display text-[1.625rem] font-extrabold leading-tight tracking-[-0.035em] [word-spacing:0.1em]"
            style={{ fontStretch: "82%" }}
          >
            {plan === "free" ? "Free covers it" : `${TIERS[plan].name} fits your event`}
          </p>
          <p className="mt-2 text-[0.8125rem] leading-normal text-ash">
            A rough guide: about ten photos per guest. Video takes more room.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mt-10">
        <PricingTable
          ctaHref={ctaHref}
          recommended={plan}
          badge={`Fits ${nf.format(guests)} guests`}
        />
      </div>
    </>
  );
}
