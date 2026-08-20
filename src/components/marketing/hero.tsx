import { MdOutlineAddCircleOutline, MdOutlineSell } from "react-icons/md";

import { ContactSheet } from "@/components/marketing/contact-sheet";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { TIERS, photoCountLabel } from "@/lib/tiers";

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-linen">
      {/* 1.2fr against 1fr, not 1.05. The headline is the widest thing on the
          page and it sets the split - a column that cannot hold `your guests
          take.` on one line is the wrong column, whatever it does for the
          picture. */}
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:gap-12 sm:px-5 sm:py-14 lg:grid-cols-[1.2fr_1fr] lg:gap-8 lg:py-20">
        <div className="rise">
          <Eyebrow>Photo collection for events</Eyebrow>

          {/* Four words and a full stop, made of the thing the product collects.
              The sentence under it is the whole mechanism, so somebody who
              reads nothing else still knows what this is. */}
          {/* Two lines, and the sizes are the ones at which the second one
              fits. `your guests take.` is seventeen characters of Archivo at
              82% width - about 0.4em each - so it needs roughly 6.8em of
              column. At 100px in the old 1.05fr column it needed 680px and had
              510: `text-wrap: balance` broke it again and left `take.` alone on
              a third line, a full line of the largest type on the page spent on
              one word. Every step below clears its own column with room to
              spare, so the rag is a decision rather than an accident.

              1.02 leading is the smallest that cannot collide - the ink height
              of the face, ascender to descender. The padding is the other
              failure: where a background is clipped to the text, Safari paints
              only inside the element's box and the last line's descenders hang
              below it. */}
          <h1 className="photo-type mt-4 pb-[0.06em] text-h1 leading-[1.02] xs:text-[3.25rem] sm:text-display xl:text-[5rem]">
            Let your guests
            <br />
            capture the moments you miss
          </h1>

          <p className="mt-5 max-w-md text-body sm:mt-6 sm:text-lead">
            They scan the code on the table. Their photos land in one place.
            No app, no account, nothing to install.
          </p>

          {/* Stacked and full-width on a phone. Two large buttons side by side
              at this width either wrap onto two lines each or leave a thumb
              hunting for a 40px gap between them. */}
          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <ButtonLink
              href={signedIn ? "/dashboard" : "/login"}
              size="lg"
              variant="primary"
              className="w-full sm:w-auto"
            >
              <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
              Create an event
            </ButtonLink>
            <ButtonLink
              href="/pricing"
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <MdOutlineSell aria-hidden className="shrink-0 text-[1.25em]" />
              See pricing
            </ButtonLink>
          </div>

          <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            Free · {photoCountLabel(TIERS.free.quotaBytes)} photos · no card
          </p>
        </div>

        <div className="lg:pl-4">
          <ContactSheet />
        </div>
      </div>
    </section>
  );
}
