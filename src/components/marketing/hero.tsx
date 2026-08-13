import { ContactSheet } from "@/components/marketing/contact-sheet";
import { ButtonLink, Eyebrow } from "@/components/ui";

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-linen">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:gap-12 sm:px-5 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-20">
        <div className="rise">
          <Eyebrow>Photo collection for events</Eyebrow>

          {/* Four words and a full stop, made of the thing the product collects.
              The sentence under it is the whole mechanism, so somebody who
              reads nothing else still knows what this is. */}
          {/* A phone does not get the two lines this is written as, and at
              `leading-[0.9]` the third arrives inside the descenders of the
              second. 1.02 is the smallest leading that cannot collide - the ink
              height of the face, ascender to descender.

              The padding is the other failure: where a background is clipped to
              the text, Safari paints only inside the element's box and the last
              line's descenders hang below it. */}
          <h1 className="photo-type mt-4 pb-[0.06em] text-[3rem] leading-[1.02] xs:text-[3.5rem] sm:text-[5rem] lg:text-[6.25rem]">
            Every photo
            <br />
            your guests take.
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
              Create an event
            </ButtonLink>
            <ButtonLink
              href="/pricing"
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              See pricing
            </ButtonLink>
          </div>

          <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            Free · 250 photos · no card
          </p>
        </div>

        <div className="lg:pl-4">
          <ContactSheet />
        </div>
      </div>
    </section>
  );
}
