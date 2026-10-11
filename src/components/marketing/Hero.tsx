import { MdCheck, MdOutlineAddCircleOutline, MdOutlineTouchApp } from "react-icons/md";

import { HeroScene } from "@/components/marketing/HeroScene";
import { ButtonLink, Eyebrow } from "@/components/ui";
import { HERO } from "@/lib/seo";

export function Hero({ signedIn }: { signedIn: boolean }) {
  const [opening, filled, closing] = HERO.headlineLines;

  return (
    <section id="top" className="relative overflow-hidden bg-linen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(70%_100%_at_50%_0%,var(--color-chalk),transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-11 px-4 pb-14 pt-9 sm:px-5 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:pb-22 lg:pt-15">
        <div className="text-center sm:text-left">
          <Eyebrow className="rise">{HERO.kicker}</Eyebrow>
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
                {["vf-tl", "vf-tr", "vf-br", "vf-bl"].map((corner) => (
                  <span key={corner} aria-hidden className={`viewfinder-corner ${corner}`} />
                ))}
              </span>
            </span>{" "}
            <span className="block">{closing}</span>
          </h1>
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
              href={signedIn ? "/dashboard" : "/signup"}
              size="lg"
              variant="primary"
              className="w-full sm:w-auto"
            >
              <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
              Create your free event
            </ButtonLink>
            <ButtonLink
              href="/demo"
              size="lg"
              variant="secondary"
              className="w-full sm:w-auto"
            >
              <MdOutlineTouchApp aria-hidden className="shrink-0 text-[1.25em]" />
              Try it as a guest
            </ButtonLink>
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 font-mono text-micro uppercase tracking-[0.14em] text-mist sm:justify-start">
            {["Free to start", "No card needed"].map((line) => (
              <li key={line} className="inline-flex items-center gap-1.5">
                <MdCheck aria-hidden className="text-[15px] text-pine" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-6 max-w-[33rem] text-[0.9375rem] leading-relaxed text-ash sm:mx-0">
            {HERO.purpose}
          </p>
        </div>

        <HeroScene />
      </div>
    </section>
  );
}
