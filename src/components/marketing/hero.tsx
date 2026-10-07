import { MdCheck, MdOutlineAddCircleOutline } from "react-icons/md";

import { HeroScene } from "@/components/marketing/hero-scene";
import { TryGuestButton } from "@/components/marketing/try-guest-button";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { HERO } from "@/lib/seo";

/**
 * What it is, how it works and what it costs, in one screen.
 *
 * The headline is the product's own tagline said as an action, with the two
 * words that are the photographs filled with them. Only those two: a whole
 * headline in photo-filled capitals ran to five lines on a phone and cost
 * legibility on every word. The picture beside it is the mechanism - the card
 * on the table and a guest's phone - and the phone can be tapped.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  const [first, second] = HERO.headlineLines;
  const [lead, rest] = first.split(HERO.headlineFill);

  return (
    <section id="top" className="relative overflow-hidden bg-linen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(70%_100%_at_50%_0%,var(--color-chalk),transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-11 px-4 pb-14 pt-9 sm:px-5 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pb-22 lg:pt-15">
        <div>
          <Eyebrow className="rise">{HERO.kicker}</Eyebrow>
          {/* 82% Archivo at -0.05em closes the word spaces right up, so they
              are opened back out; at these sizes the line stays one line. */}
          <h1
            className="rise mt-4 text-[clamp(2.6rem,1.3rem+4.3vw,4.6rem)] leading-[0.97] tracking-[-0.05em] [word-spacing:0.1em]"
            style={{ animationDelay: "60ms" }}
          >
            {lead}
            <span
              className="photo-fill inline-block pb-[0.06em]"
              style={{ "--fill": "url(/hero/variants/fill-mosaic.jpg)" } as React.CSSProperties}
            >
              {HERO.headlineFill}
            </span>
            {rest}
            <br />
            {second}
          </h1>
          <p
            className="rise mt-5 max-w-[33rem] text-body leading-[1.55] sm:text-lead"
            style={{ animationDelay: "120ms" }}
          >
            {HERO.subline}
          </p>
          <div
            id="hero-ctas"
            className="rise mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            style={{ animationDelay: "180ms" }}
          >
            <ButtonLink
              href={signedIn ? "/dashboard" : "/login"}
              size="lg"
              variant="primary"
              className="w-full sm:w-auto"
            >
              <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
              Create your free event
            </ButtonLink>
            <TryGuestButton />
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-micro uppercase tracking-[0.14em] text-mist">
            {["Free to start", "No card needed"].map((line) => (
              <li key={line} className="inline-flex items-center gap-1.5">
                <MdCheck aria-hidden className="text-[15px] text-pine" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <HeroScene />
      </div>
    </section>
  );
}
