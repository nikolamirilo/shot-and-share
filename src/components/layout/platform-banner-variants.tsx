import Link from "next/link";
import { MdOutlineAddCircleOutline } from "react-icons/md";

import { LogoMark, Wordmark } from "@/components/layout/logo";
import { ButtonLink, Hole } from "@/components/ui";
import { TIERS, photoCountLabel } from "@/lib/tiers";

/**
 * Three candidate header/footer pairs for a free event page, side by side at
 * /dev-banners. One of them replaces `platform-banner.tsx`; the other two get
 * deleted.
 *
 * The first attempt at these was three adverts in the house colours - a black
 * strip on top and a full-bleed claret band at the bottom - and it read as
 * exactly that. This set is built out of the parts the product is already made
 * of, so the rules are the system's rather than a campaign's:
 *
 * - Nothing is outlined. A pill is a pill because it floats; a band is divided
 *   off by sinking a shade, the way the site footer's colophon is.
 * - The only dark surface is a well, and a well is where a photograph goes.
 *   Ink is for type, not for a strip across somebody's cover.
 * - Claret is spent once, on the thing you press. A claret ground under our
 *   own advertisement is the one place it cannot be spent.
 * - Everything reads the theme variables rather than a fixed hex, so any of
 *   these would follow a themed page if free events ever get one.
 *
 * What they share as an argument: the header stays out of the way (a guest
 * arrived to upload, not to shop), the pitch waits for the bottom, and the
 * price is the whole pitch - free, the photo count, no app - quoted from
 * `TIERS.free` so it cannot drift from the pricing page.
 */

/** The free plan in the four words a footer has room for. Never hand-typed. */
const FREE_FACTS = [
  "Free",
  `${photoCountLabel(TIERS.free.quotaBytes)} photos`,
  `${TIERS.free.retentionDays} days`,
  "no app",
].join(" · ");

/**
 * The house's own floating bar, borrowed from `HeaderShell`: paper at 92%, a
 * soft shadow, blurred behind, on the page's gutter. The marketing site says
 * "we are here" this way on every page, and it is the one shape on an event
 * page that is unmistakably ours without taking anything from the host.
 */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl bg-paper/92 px-3.5 py-2 shadow-sm backdrop-blur sm:px-4 sm:py-2.5">
        {children}
      </div>
    </div>
  );
}

/** The mark and our name, at caption size. */
function MarkLabel({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-5 w-auto" />
      <span className="eyebrow">Shot &amp; Share</span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
   A. Pill & Card

   One object language, top and bottom: the site's floating pill over the
   cover, and the same paper floating again at the end of the page as a card.
   Nothing full-bleed, nothing dark, no rules - the two things that are ours
   are the two things on the page that float, and the host's photographs are
   the only colour in between.
   --------------------------------------------------------------------------- */

export function PlatformHeaderA() {
  return (
    <Pill>
      <Link href="/" target="_blank" rel="noopener" className="min-w-0">
        <MarkLabel />
      </Link>
      {/* Text, not a filled button. A second fill up here would be the page's
          loudest object sitting above the host's own name. */}
      <Link
        href="/"
        target="_blank"
        rel="noopener"
        className="shrink-0 font-mono text-micro uppercase tracking-[0.14em] text-claret underline decoration-claret/35 underline-offset-4 hover:decoration-claret"
      >
        Free for your event
      </Link>
    </Pill>
  );
}

export function PlatformFooterA() {
  return (
    <section className="px-4 pb-10 sm:px-5 sm:pb-12">
      <div className="card mx-auto max-w-3xl px-6 py-8 text-center sm:px-8 sm:py-10">
        <LogoMark className="mx-auto h-7 w-auto" />

        <h2 className="mt-4 text-h3 sm:text-h2">
          Your event can have one of these.
        </h2>

        <p className="mx-auto mt-3 max-w-sm text-small leading-relaxed text-ash">
          One code on the table, and every photo your guests take lands in one
          place. Nothing for them to install.
        </p>

        <ButtonLink
          href="/"
          target="_blank"
          rel="noopener"
          size="lg"
          className="mt-6 w-full sm:w-auto"
        >
          <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
          Create your free event
        </ButtonLink>

        <p className="eyebrow mt-4">{FREE_FACTS}</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   B. One more frame

   The gallery does not stop, it just runs out of photographs: the last frame
   on the roll is a well like every other tile, and what is inside it is our
   mark instead of somebody's picture. It is the only variant that is made of
   the page's own object rather than placed after it, and the only one a guest
   meets while still scrolling photographs rather than after leaving them.

   The riskiest of the three, and deliberately so - a well is where a picture
   goes, and putting ourselves in one is a claim. It is also the reason it does
   not read as an advert: it reads as the end of the film.
   --------------------------------------------------------------------------- */

export function PlatformHeaderB() {
  return (
    <Pill>
      {/* Nothing to press up here at all. This variant spends its whole ask on
          the frame at the end of the gallery. */}
      <Link href="/" target="_blank" rel="noopener">
        <Wordmark markClassName="h-5 w-auto" labelClassName="text-[0.9375rem]" />
      </Link>
      <span className="eyebrow shrink-0">Free event page</span>
    </Pill>
  );
}

export function PlatformFooterB() {
  return (
    <section className="px-4 pb-12 sm:px-5 sm:pb-14">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">End of the roll</p>

        {/* Square, same radius and same well as a tile in the Grid layout, so
            it sits in the sequence rather than after it. Wider than a tile
            because it holds a sentence: three columns of photographs, and this
            takes the width of all three. */}
        <div className="recess mt-3 flex flex-col items-center gap-5 px-6 py-9 text-center sm:flex-row sm:justify-between sm:gap-6 sm:px-8 sm:text-left">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <LogoMark variant="reversed" className="h-9 w-auto shrink-0" />
            <span>
              <h2 className="text-[1.375rem] text-chalk">Your own, free</h2>
              <span className="mt-1.5 block font-mono text-micro uppercase tracking-[0.16em] text-rose-soft">
                {FREE_FACTS}
              </span>
            </span>
          </div>

          <ButtonLink
            href="/"
            target="_blank"
            rel="noopener"
            variant="onDark"
            className="w-full shrink-0 sm:w-auto"
          >
            Collect photos at your event
          </ButtonLink>
        </div>

        <p className="mt-3 text-label leading-relaxed text-mist">
          This is how the host collected every photo above - one code on the
          table, no app and no accounts.
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   C. The caption

   The quietest thing the page can say and still say something. No bar over the
   cover at all: our name is a caption under it, in the register the system
   keeps for machine-readable things, next to the host's date. At the end, the
   ground sinks a shade - the site footer's own way of dividing without a rule -
   and holds three holes, one line and one link.

   Nothing here is filled, so nothing competes with the upload button. The bet
   is that on somebody's wedding, the smallest voice is the most persuasive one.
   --------------------------------------------------------------------------- */

export function PlatformHeaderC() {
  return (
    <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 pt-3 sm:px-5 sm:pt-4">
      <LogoMark className="h-4 w-auto opacity-80" />
      <Link
        href="/"
        target="_blank"
        rel="noopener"
        className="eyebrow underline decoration-edge underline-offset-4 hover:decoration-mist"
      >
        Free event page by Shot &amp; Share
      </Link>
    </div>
  );
}

export function PlatformFooterC() {
  return (
    <section className="bg-blush">
      <div className="mx-auto max-w-3xl px-4 py-11 text-center sm:px-5 sm:py-14">
        {/* The three holes from the closed page: the house's way of signing
            itself without a logo lockup. */}
        <div className="flex justify-center gap-2.5">
          <Hole size={14} />
          <Hole size={22} />
          <Hole size={11} />
        </div>

        <h2 className="mt-6 text-h3 sm:text-h2">
          Having an event of your own?
        </h2>

        <p className="mx-auto mt-3 max-w-md text-small leading-relaxed text-ash">
          This is how the host collected every photo here - one code on the
          table, no app and no accounts.
        </p>

        <p className="eyebrow mt-4">{FREE_FACTS}</p>

        <Link
          href="/"
          target="_blank"
          rel="noopener"
          className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-claret underline decoration-2 decoration-claret/40 underline-offset-4 hover:decoration-claret"
        >
          Set one up in two minutes
        </Link>
      </div>
    </section>
  );
}
