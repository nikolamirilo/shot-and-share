import Link from "next/link";
import {
  MdOutlineAddCircleOutline,
  MdOutlinePhotoLibrary,
} from "react-icons/md";

import { LogoMark, Wordmark } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui";
import { TIERS, photoCountLabel } from "@/lib/tiers";

/**
 * Three candidate header/footer pairs for a free event page, side by side at
 * /dev-banners. One of them replaces `platform-banner.tsx`; the other two get
 * deleted.
 *
 * All three answer the same question: a guest is on somebody else's event page
 * with photos in their hand, and the only thing we want out of that visit is
 * the thought "I want one of these for mine". So the rules they share:
 *
 * - The header stays out of the way. A guest who arrived to upload a photo is
 *   not shopping, and a loud bar over the host's cover is the fastest way to
 *   look like an advert on their wedding.
 * - The pitch goes at the bottom, after the guest has used the thing. By then
 *   they know what it does, and the footer only has to name it and price it.
 * - The price is the argument. "Free", the photo count and "no app, no
 *   account" do more work here than any adjective, so every variant states
 *   them, and states them from `TIERS.free` so they cannot drift.
 * - One button. A footer with three equal choices converts worse than a footer
 *   with one, so the second option is always a plain link.
 */

/** Free plan, in the four words a footer has room for. Never hand-typed. */
const FREE_FACTS = [
  "Free",
  `${photoCountLabel(TIERS.free.quotaBytes)} photos`,
  `${TIERS.free.retentionDays} days`,
  "no app",
].join(" · ");

/* ---------------------------------------------------------------------------
   A. Bar & Band

   The smallest change from what is live: the same dark strip on top, and a
   claret band at the bottom instead of the quiet blush one. Claret is the
   colour the landing page spends on "press this", and the bottom of an event
   page is the one place on a guest's screen where we are allowed to spend it.
   Safest of the three, and the loudest at the point where loud is earned.
   --------------------------------------------------------------------------- */

export function PlatformHeaderA() {
  return (
    <div className="bg-ink">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 sm:px-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2"
          target="_blank"
          rel="noopener"
        >
          <LogoMark variant="reversed" className="h-6 w-auto" />
          <span className="font-mono text-micro uppercase tracking-[0.16em] text-linen/70">
            Shot &amp; Share
          </span>
        </Link>

        {/* A pill rather than the underlined link that is there now. Same
            words, same target; a shape is tappable on a phone in a way that
            eleven pixels of underlined mono is not. `sm` and `onDark` keep it
            a chip - a full button here would compete with the upload one. */}
        <ButtonLink
          href="/"
          target="_blank"
          rel="noopener"
          size="sm"
          variant="onDark"
          className="rounded-full px-3 font-mono text-micro uppercase tracking-[0.14em]"
        >
          Try it free
        </ButtonLink>
      </div>
    </div>
  );
}

export function PlatformFooterA() {
  return (
    <section className="bg-claret text-chalk">
      <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-5 sm:py-16">
        <p className="font-mono text-micro uppercase tracking-[0.18em] text-chalk/70">
          Made with Shot &amp; Share
        </p>

        <h2 className="mt-3 text-[1.875rem] leading-[1.08] sm:text-[2.75rem]">
          Your event can have
          <br />
          one of these.
        </h2>

        <p className="mx-auto mt-4 max-w-md text-small leading-relaxed text-chalk/75 sm:text-body">
          One code on the table, and every photo your guests take lands in one
          place. Set it up tonight and send the link to one friend.
        </p>

        <ButtonLink
          href="/"
          target="_blank"
          rel="noopener"
          size="lg"
          variant="onDark"
          className="mt-7 w-full sm:w-auto"
        >
          <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
          Create your free event
        </ButtonLink>

        <p className="mt-5 font-mono text-micro uppercase tracking-[0.16em] text-chalk/65">
          {FREE_FACTS}
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   B. The receipt

   Quietest header of the three - no call to action at all - and a footer that
   explains the mechanism instead of selling it: three steps, in the order they
   happened, ending on the guest's own tap. Somebody who has just uploaded a
   photo already believes the product works; what they usually do not know is
   how little the host had to do. That is the sentence that turns a guest into
   a host, so it is the whole footer.

   The second link goes to /demo rather than to sign-up: it costs no account,
   which makes it the cheapest possible next step for somebody who is curious
   at midnight at a wedding.
   --------------------------------------------------------------------------- */

const STEPS = [
  { n: "01", label: "The host made an event", note: "Two minutes, no card." },
  { n: "02", label: "A code went on the table", note: "Printed, or on a phone." },
  { n: "03", label: "You added a photo", note: "No app, no account." },
];

export function PlatformHeaderB() {
  return (
    <div className="border-b border-edge bg-paper">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
        <Link href="/" target="_blank" rel="noopener">
          <Wordmark markClassName="h-5 w-auto" labelClassName="text-[0.9375rem]" />
        </Link>
        {/* Not a button and not underlined: a caption. On a page that belongs
            to somebody else, a caption is the most we should take. */}
        <span className="font-mono text-micro uppercase tracking-[0.16em] text-mist">
          Free event page
        </span>
      </div>
    </div>
  );
}

export function PlatformFooterB() {
  return (
    <section className="bg-blush">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-5 sm:py-12">
        {/* A print on the table: paper, a shadow, nothing outlined - the same
            object the gallery above is made of. */}
        <div className="rounded-card bg-paper p-6 shadow-md sm:p-8">
          <p className="eyebrow">How these photos got here</p>

          <ol className="mt-5 grid gap-4 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-3 sm:block">
                <span className="font-mono text-micro tracking-[0.16em] text-claret">
                  {step.n}
                </span>
                <span className="block sm:mt-2">
                  <span className="block text-small font-semibold leading-snug">
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-label text-ash">
                    {step.note}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-7 border-t border-edge pt-6 text-center sm:mt-8">
            <p className="text-body font-semibold sm:text-lead">
              Doing the same for your own event costs nothing.
            </p>
            <p className="mx-auto mt-2 max-w-sm text-small leading-relaxed text-ash">
              {photoCountLabel(TIERS.free.quotaBytes)} photos, kept{" "}
              {TIERS.free.retentionDays} days, on the free plan. No card.
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
              <ButtonLink
                href="/"
                target="_blank"
                rel="noopener"
                size="lg"
                className="w-full sm:w-auto"
              >
                <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
                Start a free event
              </ButtonLink>
              <Link
                href="/demo"
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center gap-2 font-semibold underline decoration-2 underline-offset-4 decoration-claret/40 hover:decoration-claret"
              >
                <MdOutlinePhotoLibrary aria-hidden className="shrink-0 text-[1.15em]" />
                See a finished gallery
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   C. Sticky invite

   Nothing in the header but the mark, a short dark footer, and the actual
   pitch in a bar that slides up once the guest has scrolled past the gallery -
   see `platform-invite-bar.tsx`. The bar is the only variant here that catches
   the guest who never reaches the bottom of the page, which on a phone at a
   party is most of them.

   The cost is that it is the only one that puts our shape on top of the host's
   photographs. It is dismissible, stays dismissed for the session, and never
   appears before the guest has seen the gallery - all three are the price of
   being allowed to float at all.
   --------------------------------------------------------------------------- */

export function PlatformHeaderC() {
  return (
    <div className="bg-ink">
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-2 sm:px-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2"
          target="_blank"
          rel="noopener"
        >
          <LogoMark variant="reversed" className="h-5 w-auto" />
          <span className="font-mono text-micro uppercase tracking-[0.16em] text-linen/70">
            Shot &amp; Share
          </span>
        </Link>
      </div>
    </div>
  );
}

export function PlatformFooterC() {
  return (
    <section className="bg-ink text-linen">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-9 text-center sm:flex-row sm:justify-between sm:gap-6 sm:px-5 sm:py-10 sm:text-left">
        <div>
          <h2 className="text-h3 leading-tight text-linen sm:text-[1.75rem]">
            Free for your event too
          </h2>
          <p className="mt-2 text-small leading-relaxed text-linen/70">
            One code on the table, and every photo your guests take lands in
            one place.
          </p>
          <p className="mt-3 font-mono text-micro uppercase tracking-[0.16em] text-linen/55">
            {FREE_FACTS}
          </p>
        </div>

        <ButtonLink
          href="/"
          target="_blank"
          rel="noopener"
          size="lg"
          variant="onDark"
          className="w-full shrink-0 sm:w-auto"
        >
          Create your event
        </ButtonLink>
      </div>
    </section>
  );
}
