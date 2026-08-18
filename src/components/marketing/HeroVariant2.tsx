import Image from "next/image";
import { Fragment } from "react";
import {
  MdOutlineAddCircleOutline,
  MdOutlinePlayCircleOutline,
} from "react-icons/md";

import { ButtonLink } from "@/components/ui";
import { HERO } from "@/lib/seo";

/**
 * Variant 2 - centred type over a mosaic floor.
 *
 * The headline is the tagline, set in the product's own material: twelve real
 * frames tiled into one picture and clipped to the letterforms. Under it, the
 * floor - the same twelve photographs at tile size, bled to both edges, with
 * the night's count resting on top of them.
 *
 * The argument the layout makes: the words are made of the photos, and the
 * photos are what you get. Nothing else is on the screen.
 */

/** The twelve frames in `public/hero/variants`. See CREDITS.json for sources. */
const FRAMES = [
  "01", "02", "03", "04", "05", "06",
  "07", "08", "09", "10", "11", "12",
] as const;

/** Three rows, each starting on a different frame so no column repeats. */
const ROWS = [0, 5, 9];

/** Twelve per row: at `lg` all twelve land, below it the row is clipped. */
const PER_ROW = 12;

export function HeroVariant2({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden bg-linen">
      {/* The daylight the old hero never had: chalk at the top settling into
          linen, so the page opens lighter than it ends. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(70%_100%_at_50%_0%,var(--color-chalk),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-12 text-center sm:px-5 sm:pb-14 sm:pt-20">
        <p className="eyebrow rise" style={{ letterSpacing: "0.34em" }}>
          {HERO.kicker}
        </p>

        {/* Uppercase, and the sizes are the ones at which `your guests take.`
            still clears its line. Capitals in Archivo run about 30% wider than
            the lowercase of the same string - measured, not guessed - so this
            steps down harder than it looks like it should. */}
        <h1
          className="photo-fill rise mt-4 pb-[0.06em] text-[clamp(3.25rem,8vw,6rem)] uppercase leading-[0.96]"
          style={{
            "--fill": "url(/hero/variants/fill-mosaic.jpg)",
            fontStretch: "82%",
            wordSpacing: "0.08em",
            animationDelay: "80ms",
          } as React.CSSProperties}
        >
          {HERO.headlineLines.map((line, i) => (
            <Fragment key={line}>
              {i > 0 && <br />}
              {line}
            </Fragment>
          ))}
        </h1>

        <p
          className="rise mx-auto mt-5 max-w-sm text-body sm:mt-6 sm:max-w-md sm:text-lead"
          style={{ animationDelay: "160ms" }}
        >
          {HERO.subline}
        </p>

        <div
          className="rise mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center sm:gap-4"
          style={{ animationDelay: "240ms" }}
        >
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
            href="/#how"
            size="lg"
            variant="secondary"
            className="w-full sm:w-auto"
          >
            <MdOutlinePlayCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
            See how it works
          </ButtonLink>
        </div>
      </div>

      {/* --- The floor -------------------------------------------------------
          Three rows of square frames, edge to edge. Each row is its own
          clipped flex line rather than a grid, because the tile count has to
          change with the breakpoint while the row stays exactly full: twelve
          at `lg`, six at `sm`, four on a phone, and the overflow is simply
          cut off. */}
      <div aria-hidden className="relative select-none">
        {ROWS.map((offset, row) => (
          <div key={row} className="flex overflow-hidden">
            {Array.from({ length: PER_ROW }, (_, i) => {
              const frame = FRAMES[(offset + i * 5 + row * 3) % FRAMES.length];
              return (
                <div
                  key={i}
                  className="tile-in relative aspect-square w-1/4 shrink-0 sm:w-1/6 lg:w-1/12"
                  style={{ animationDelay: `${360 + (i * 2 + row) * 26}ms` }}
                >
                  <Image
                    src={`/hero/variants/${frame}.jpg`}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 9vw, (min-width: 640px) 17vw, 25vw"
                    className="object-cover"
                    /* The floor is above the fold on a laptop; only the third
                       row can afford to wait. */
                    loading={row < 2 ? "eager" : "lazy"}
                  />
                  {/* A hairline of the page colour between frames, which is
                      what makes this read as a contact sheet rather than as
                      one continuous image. */}
                  <span className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(246,242,243,0.55)]" />
                </div>
              );
            })}
          </div>
        ))}

        {/* The floor rises out of the page rather than starting abruptly. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-[linear-gradient(180deg,var(--color-linen),transparent)]" />
      </div>

      {/* The count, resting on the middle row. It is the one number on the
          screen and it is the whole promise: this many, from that many. */}
      {/* <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-1/3 items-center justify-center">
        <div
          className="rise rounded-2xl bg-paper px-7 py-4 text-center shadow-lg"
          style={{ animationDelay: "620ms" }}
        >
          <p className="font-display text-[2.5rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums sm:text-[3rem]">
            55s
          </p>
          <p className="mt-1.5 font-mono text-micro uppercase tracking-[0.16em] text-mist">
            needed to get started
          </p>
        </div>
      </div> */}
    </section>
  );
}
