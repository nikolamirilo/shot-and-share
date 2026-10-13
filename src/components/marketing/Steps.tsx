import { LottiePlayer } from "@/components/marketing/LottiePlayer";
import create from "@/components/marketing/lottie/create.json";
import keep from "@/components/marketing/lottie/keep.json";
import table from "@/components/marketing/lottie/table.json";
import {
  CreateArt,
  KeepArt,
  TableArt,
} from "@/components/marketing/StepArt";
import { ButtonLink, Eyebrow, FreeTag } from "@/components/ui";

export function Steps({ signedIn }: { signedIn: boolean }) {
  const steps = [
    {
      n: "01",
      when: "The week before",
      art: <CreateArt />,
      data: create,
      rest: 150,
      title: "Make your event",
      body: "Add a name and a date, and you get a link and a QR code to print. It takes about a minute, and there is nothing to pay yet.",
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
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-5 sm:py-16 lg:py-24">
        <Eyebrow className="text-ash">How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[2.25rem] [word-spacing:0.1em] sm:text-[4rem]">
          Three steps, and one of them is printing.
        </h2>

        <ol className="mt-6 grid gap-2.5 sm:mt-10 sm:gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className="flex items-center gap-3 rounded-2xl bg-paper p-2.5 shadow-md md:flex-col md:items-stretch md:gap-0 md:rounded-[1.25rem] md:p-4"
            >
              <div className="flex w-[6.5rem] shrink-0 items-center justify-center rounded-xl bg-linen px-2 py-2.5 md:w-auto md:rounded-2xl md:px-3 md:py-3.5">
                <LottiePlayer
                  data={step.data}
                  rest={step.rest}
                  className="aspect-[200/132] w-full max-w-[13rem]"
                >
                  {step.art}
                </LottiePlayer>
              </div>

              <div className="min-w-0 flex-1 md:mt-3.5">
                <div className="flex items-center gap-2">
                  <span className="hole inline-flex h-7 w-7 shrink-0 items-center justify-center font-mono text-[0.625rem] tracking-[0.1em] text-rose-soft md:h-8 md:w-8">
                    {step.n}
                  </span>
                  <Eyebrow className="text-[0.5625rem] tracking-[0.12em] md:text-[0.6875rem] md:tracking-[0.18em]">
                    {step.when}
                  </Eyebrow>
                </div>
                <h3 className="mt-1.5 text-[1.0625rem] leading-tight [word-spacing:0.1em] md:mt-2 md:text-[1.375rem] md:leading-[1.05]">
                  {step.title}
                </h3>
                <p className="mt-1 text-[0.8125rem] leading-snug text-ash md:mt-1.5 md:text-[0.875rem] md:leading-[1.5]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 sm:mt-10">
          <ButtonLink
            href={signedIn ? "/dashboard" : "/signup"}
            size="lg"
            variant="primary"
            className="w-full sm:w-auto"
          >
            Create your event
            <FreeTag />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
