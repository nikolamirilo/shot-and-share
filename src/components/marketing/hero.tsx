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
 *
 * Those two words are also the loud ones: their own line, a quarter larger
 * than the lines above and below, inside the mark's four corner brackets, with
 * the photographs drifting through them. Three decisions pulling the same way,
 * so the first thing read on the page is what the page is for.
 */
export function Hero({ signedIn }: { signedIn: boolean }) {
  const [opening, filled, closing] = HERO.headlineLines;

  return (
    <section id="top" className="relative overflow-hidden bg-linen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(70%_100%_at_50%_0%,var(--color-chalk),transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-11 px-4 pb-14 pt-9 sm:px-5 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pb-22 lg:pt-15">
        {/* Centred on a phone, left-aligned from `sm` up.

            A phone gives the headline the full width of the screen and nothing
            to sit beside, so centred is the arrangement that holds it: the
            frame around `every photo` lands on the middle of the screen, and
            the three lines stack symmetrically around it. From `sm` the column
            is reading-width copy with the picture to come, and centred copy at
            that length is harder to read than left-aligned, so it goes back.

            Only the alignment changes. The buttons are full-width and already
            centre their own labels, so they look the same either way. */}
        <div className="text-center sm:text-left">
          <Eyebrow className="rise">{HERO.kicker}</Eyebrow>
          {/* 82% Archivo at -0.05em closes the word spaces right up, so they
              are opened back out; at these sizes every line stays one line.

              The lines are blocks rather than `<br>`s because the middle one
              carries its own size and its own frame. The spaces between them
              are kept so the heading is still one sentence to anything reading
              the text rather than the layout.

              Two curves, because a phone and a desktop are solving different
              problems. The old floor of 2.6rem was set by `Collect every
              photo` on one line - 6.9em of type, which only just cleared a
              360px phone. The three-line break made the longest line 6.1em,
              and the floor stayed, so every phone from 360px up was holding
              its headline at the smallest size the clamp allows with a sixth
              of the measure unused: 64% of the line at 430px. Below `sm` the
              size now comes off the width instead, which keeps the headline on
              about 86% of the measure the whole way across - the same share it
              has always had on the narrowest phone and on a desktop.

              The two meet at 3.6rem on 640px exactly, so there is no step at
              the breakpoint, and from about 856px up the desktop curve is
              untouched. The floor is still there for anything narrower than
              about 283px: the middle line cannot wrap, so it has to be allowed
              to get small rather than run off the side. */}
          <h1
            className="rise mt-4 text-[clamp(2.3rem,13vw,3.6rem)] leading-[0.97] tracking-[-0.05em] [word-spacing:0.1em] sm:text-[clamp(3.6rem,1.3rem+4.3vw,4.6rem)]"
            style={{ animationDelay: "60ms" }}
          >
            <span className="block">{opening}</span>{" "}
            <span className="block">
              <span className="viewfinder text-[1.25em]">
                <span
                  className="photo-fill photo-fill-drift inline-block whitespace-nowrap pb-[0.06em]"
                  style={{ "--fill": "url(/hero/variants/fill-mosaic.jpg)" } as React.CSSProperties}
                >
                  {filled}
                </span>
                {/* Clockwise from the top left, so the frame closes the way a
                    camera finds its subject. */}
                {["vf-tl", "vf-tr", "vf-br", "vf-bl"].map((corner) => (
                  <span key={corner} aria-hidden className={`viewfinder-corner ${corner}`} />
                ))}
              </span>
            </span>{" "}
            <span className="block">{closing}</span>
          </h1>
          {/* `mx-auto` for the band between 568px and `sm`, where the measure
              is narrower than the column: without it the centred text is
              centred inside a box that is itself off to the left. */}
          <p
            className="rise mx-auto mt-5 max-w-[33rem] text-body leading-[1.55] sm:mx-0 sm:text-lead"
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
          <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 font-mono text-micro uppercase tracking-[0.14em] text-mist sm:justify-start">
            {["Free to start", "No card needed"].map((line) => (
              <li key={line} className="inline-flex items-center gap-1.5">
                <MdCheck aria-hidden className="text-[15px] text-pine" />
                {line}
              </li>
            ))}
          </ul>
          {/* The plain sentence, last in the column. Quiet, because a visitor
              has already got it from the headline and the picture; present,
              because anything reading the markup has not. Below the buttons
              rather than above them, so three lines of copy a reader does not
              need do not push the only thing they came to press off a phone
              screen. */}
          <p
            className="rise mx-auto mt-6 max-w-[33rem] text-[0.9375rem] leading-relaxed text-ash sm:mx-0"
            style={{ animationDelay: "240ms" }}
          >
            {HERO.purpose}
          </p>
        </div>

        <HeroScene />
      </div>
    </section>
  );
}
