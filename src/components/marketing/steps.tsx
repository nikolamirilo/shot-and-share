import {
  CreateArt,
  KeepArt,
  TableArt,
} from "@/components/marketing/step-art";
import { Eyebrow } from "@/components/ui";

/**
 * The mechanism, in three beats. The drawing carries it; the line underneath
 * says the one thing a drawing cannot - what it costs, when, and what you get.
 */
export function Steps() {
  const steps = [
    {
      n: "01",
      art: <CreateArt />,
      title: "Create the event",
      body: "A link and a printable card, before you pay anything.",
    },
    {
      n: "02",
      art: <TableArt />,
      title: "Put the code on the tables",
      body: "Guests point a camera at it. That is the whole instruction.",
    },
    {
      n: "03",
      art: <KeepArt />,
      title: "Keep everything",
      body: "One gallery as they arrive, one ZIP the morning after.",
    },
  ];

  return (
    <section id="how" className="bg-blush">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 lg:py-24">
        <Eyebrow className="text-ash">How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[2.25rem] sm:text-[4rem]">
          Three things to do, and one of them is printing.
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
                {step.art}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <span className="hole inline-flex h-9 w-9 shrink-0 items-center justify-center font-mono text-[0.6875rem] tracking-[0.1em] text-rose-soft">
                  {step.n}
                </span>
                <h3 className="text-h3">{step.title}</h3>
              </div>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ash">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
