import {
  MdOutlineAddCircleOutline,
  MdOutlinePhotoLibrary,
} from "react-icons/md";

import { ButtonLink, Photo } from "@/components/ui";
import { TIERS, photoCountLabel } from "@/lib/tiers";

/**
 * Variant 3 - the same headline, over one minute of a real night.
 *
 * Nine frames of 22:47, fanned. Under them, the ribbon: every minute from
 * 19:00 to 03:00, tall where photos poured in and grey where nobody shot.
 *
 * What ships here is the picture and its arrival. The ribbon is drawn but not
 * yet draggable - that needs a range input, a canvas redrawn on resize and a
 * `touch-action` that does not fight page scroll, which is a client component
 * and a separate piece of work. Marked `aria-hidden` until it can be operated.
 */

/** Nine of the twelve frames in `public/hero/variants`. */
const FAN = ["07", "12", "09", "04", "02", "06", "05", "10", "03"] as const;

/** Fixed, never random: a seeded jitter has to survive hydration. */
const JITTER = [-1.1, 0.6, -0.4, 1.2, -0.2, 0.9, -1.0, 0.5, -0.7];

/**
 * The arc, resolved once at module scope. Index 4 is the centre card: full
 * size, unrotated, on top. Everything else falls away from it.
 */
const CARDS = FAN.map((frame, i) => {
  const t = (i - 4) / 4;
  return {
    frame,
    x: `${50 + t * 33}%`,
    scale: (1 - Math.abs(t) * 0.38).toFixed(3),
    rotate: `${(t * 7 + JITTER[i]).toFixed(1)}deg`,
    opacity: (1 - Math.abs(t) * 0.15).toFixed(2),
    z: 10 - Math.round(Math.abs(t) * 4),
    /** Dealt outward from the centre, so the eye lands on 22:47 first. */
    delay: 240 + Math.abs(i - 4) * 90,
  };
});

/** 240 ticks standing in for 481 minutes - one bar per two minutes. */
const TICKS = Array.from({ length: 240 }, (_, k) => {
  const u = k / 239;
  const shape =
    0.1 +
    0.9 *
      Math.max(
        0,
        Math.sin(u * Math.PI) * 0.55 +
          Math.exp(-(((u - 0.58) / 0.07) ** 2)) * 0.85 +
          Math.exp(-(((u - 0.82) / 0.1) ** 2)) * 0.45 -
          0.12,
      );
  const hashed = ((k * 2654435761) % 997) / 997 - 0.5;
  return {
    h: Math.max(6, Math.min(100, (shape + hashed * 0.2) * 100)),
    quiet: (k * 40503) % 97 < 9,
  };
});

const HOURS = ["19", "20", "21", "22", "23", "00", "01", "02", "03"];

export function HeroVariant3({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden bg-linen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_26%,#fff,transparent_72%)]"
      />

      <div className="relative mx-auto max-w-[97.5rem] px-4 pt-6 sm:px-5 sm:pt-8">
        {/* --- The arc -----------------------------------------------------
            Below `lg` this is a scroll-snap rail: nine overlapping cards
            inside 390px is nine unreadable slivers. From `lg` the `.arc`
            class lifts each card onto its own coordinates. */}
        <ul
          className="arc -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-5 sm:px-5 lg:mx-0 lg:h-[clamp(17rem,24vw,30rem)] lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0"
          style={{ scrollPaddingInline: "1rem" }}
        >
          {CARDS.map((card, i) => (
            <li
              key={card.frame}
              className="deal rise w-[62vw] shrink-0 snap-center rounded-2xl bg-paper p-2 shadow-lg sm:w-[38vw]"
              style={{
                "--x": card.x,
                "--w": "clamp(15rem, 21vw, 25rem)",
                "--sc": card.scale,
                "--rot": card.rotate,
                "--op": card.opacity,
                "--z": card.z,
                animationDelay: `${card.delay}ms`,
              } as React.CSSProperties}
            >
              <div className="relative aspect-4/5 overflow-hidden rounded-xl">
                <Photo
                  src={`/hero/variants/${card.frame}.jpg`}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 21vw, (min-width: 640px) 38vw, 62vw"
                  className="object-cover"
                  /* Above the fold when this is the hero, so nothing here may
                     be deferred: the centre frame is the LCP candidate and is
                     preloaded, the other eight simply load immediately rather
                     than waiting for an intersection that already happened. */
                  priority={i === 4}
                  loading={i === 4 ? undefined : "eager"}
                />
              </div>
            </li>
          ))}
        </ul>

        {/* --- The copy ----------------------------------------------------
            Headline in columns 1-8, buttons in 9-12. They cannot collide,
            which they did when the headline was allowed the full width. */}
        <div className="mt-6 grid gap-x-6 gap-y-6 lg:mt-8 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-8">
            <h1
              className="photo-fill rise pb-[0.06em] text-[clamp(2.75rem,7vw,8.625rem)] uppercase leading-[1.03]"
              style={{
                "--fill": "url(/hero/variants/fill-frame.jpg)",
                fontStretch: "62%",
                animationDelay: "700ms",
              } as React.CSSProperties}
            >
              Every photo
              <br />
              your guests take.
            </h1>

            <p
              className="rise mt-5 max-w-2xl text-body text-ash sm:text-lead"
              style={{ animationDelay: "790ms" }}
            >
              Drag the ribbon to walk the night, minute by minute. Every frame
              came off a guest&rsquo;s phone.
            </p>
          </div>

          <div
            className="rise flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:flex-col lg:items-end lg:pt-3"
            style={{ animationDelay: "860ms" }}
          >
            <ButtonLink
              href={signedIn ? "/dashboard" : "/login"}
              size="lg"
              variant="primary"
              className="w-full sm:w-auto lg:w-full lg:max-w-xs"
            >
              <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
              Create an event
            </ButtonLink>
            <ButtonLink
              href="/e/demo"
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto lg:w-full lg:max-w-xs"
            >
              <MdOutlinePhotoLibrary aria-hidden className="shrink-0 text-[1.25em]" />
              Open all 2,140 photos
            </ButtonLink>
            <p className="mt-1 font-mono text-micro uppercase tracking-[0.14em] text-mist lg:text-right">
              Free to {photoCountLabel(TIERS.free.quotaBytes)} photos &middot; no card
            </p>
          </div>
        </div>
      </div>

      {/* --- The ribbon ----------------------------------------------------
          Full-bleed, and wiped in from 19:00 towards 03:00. Decorative until
          the drag interaction lands, so it is hidden from assistive tech
          rather than announced as a control nobody can operate. */}
      <div
        aria-hidden
        className="ribbon-reveal relative mt-6 h-32 w-full select-none sm:mt-8 sm:h-36"
        style={{ animationDelay: "940ms" }}
      >
        {/* The chip rides above the tallest tick, inside the box that carries
            it - parked on the minute the fan above is showing. */}
        <div className="absolute left-[58%] top-2 -translate-x-1/2">
          <span className="inline-block rounded-lg bg-paper px-2.5 py-1 font-mono text-label tabular-nums shadow-md">
            22:47
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-8 flex h-16 items-end gap-px px-px sm:h-20">
          {TICKS.map((tick, i) => (
            <span
              key={i}
              className={
                tick.quiet
                  ? "min-w-px flex-1 bg-edge"
                  : "min-w-px flex-1 bg-claret/40"
              }
              style={{ height: `${tick.h}%` }}
            />
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-8 h-px bg-edge" />
        <div className="absolute bottom-8 left-[58%] h-16 w-0.5 bg-claret sm:h-20" />

        <div className="absolute inset-x-0 bottom-1 flex justify-between px-2 font-mono text-[0.625rem] text-mist">
          {HOURS.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      </div>

    </section>
  );
}
