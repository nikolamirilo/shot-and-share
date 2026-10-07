import { MdOutlineAddCircleOutline } from "react-icons/md";

import { LottiePlayer } from "@/components/marketing/lottie-player";
import create from "@/components/marketing/lottie/create.json";
import keep from "@/components/marketing/lottie/keep.json";
import table from "@/components/marketing/lottie/table.json";
import {
  CreateArt,
  KeepArt,
  TableArt,
} from "@/components/marketing/step-art";
import { ButtonLink, Eyebrow } from "@/components/ui";

/**
 * The mechanism, in three beats. The drawing carries it; the line underneath
 * says the one thing a drawing cannot - what it costs, when, and what you get.
 *
 * The drawings move now (Lottie, generated from these same shapes), and each
 * step says when it happens, which is the host's real question about it. The
 * static drawing is the fallback and the reduced-motion picture.
 */
export function Steps({ signedIn }: { signedIn: boolean }) {
  const steps = [
    {
      n: "01",
      when: "The week before",
      art: <CreateArt />,
      data: create,
      rest: 150,
      title: "Make your event",
      body: "Add a name and a date, and you get a link and a QR card to print. It takes about a minute, and there is nothing to pay yet.",
    },
    {
      n: "02",
      when: "On the night",
      art: <TableArt />,
      data: table,
      rest: 92,
      title: "Put the code on the tables",
      body: "Guests point their camera at it and add photos straight from their phone. That is the whole instruction.",
    },
    {
      n: "03",
      when: "The morning after",
      art: <KeepArt />,
      data: keep,
      rest: 160,
      title: "Take them home",
      body: "Everything lands in one gallery as the night goes on, and comes down as one ZIP in the morning.",
    },
  ];

  return (
    <section id="how" className="bg-blush">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 lg:py-24">
        <Eyebrow className="text-ash">How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[2.25rem] [word-spacing:0.1em] sm:text-[4rem]">
          Three steps, and one of them is printing.
        </h2>

        <ol className="mt-9 grid gap-4 sm:mt-12 sm:gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className="flex flex-col rounded-[1.25rem] bg-paper p-5 shadow-md sm:p-6"
            >
              {/* The drawing sits in its own sunken field rather than loose on
                  the card. Three illustrations of different densities need a
                  shared edge or the row reads as three unrelated things. */}
              <div className="flex items-center justify-center rounded-2xl bg-linen px-4 py-5">
                <LottiePlayer
                  data={step.data}
                  rest={step.rest}
                  className="aspect-[200/132] w-full max-w-[15rem]"
                >
                  {step.art}
                </LottiePlayer>
              </div>

              <div className="mt-5 flex items-center gap-2.5">
                <span className="hole inline-flex h-9 w-9 shrink-0 items-center justify-center font-mono text-[0.6875rem] tracking-[0.1em] text-rose-soft">
                  {step.n}
                </span>
                <Eyebrow>{step.when}</Eyebrow>
              </div>
              <h3 className="mt-2.5 text-h3 [word-spacing:0.1em]">{step.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ash">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        {/* At the moment the visitor understands the product. */}
        <div className="mt-8 sm:mt-10">
          <ButtonLink
            href={signedIn ? "/dashboard" : "/login"}
            size="lg"
            variant="primary"
            className="w-full sm:w-auto"
          >
            <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
            Create your free event
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
