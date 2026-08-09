import { Slab } from "@/components/marketing/slab";
import { ButtonLink, Eyebrow } from "@/components/ui";

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-butter">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:gap-12 sm:px-5 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-20">
        <div className="rise">
          <Eyebrow>Photo collection for events</Eyebrow>

          {/* A fact, not a slogan. Most hosts genuinely see a tiny fraction of
              the photos taken at their own event, and saying so plainly does
              more work than any tagline would. */}
          <h1 className="mt-4 text-[2.375rem] leading-[0.98] xs:text-[2.75rem] sm:text-[4rem] lg:text-[5.5rem]">
            Two hundred guests took two thousand photos.
            <br />
            <span className="text-rind">You saw fifty.</span>
          </h1>

          <p className="mt-5 max-w-xl text-body sm:mt-6 sm:text-lead">
            Guests scan a code on the table and hand you their photos. No app, no
            account, nothing to install. It takes them about twenty seconds.
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

          <p className="mt-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
            Free plan · 250 photos · clean QR code · no card
          </p>
        </div>

        <div className="lg:pl-4">
          <Slab />
        </div>
      </div>
    </section>
  );
}
