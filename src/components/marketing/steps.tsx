import { Eyebrow } from "@/components/ui";

export function Steps() {
  const steps = [
    {
      n: "01",
      title: "Create the event",
      body: "Name it, pick the date. You get a link and a printable QR card straight away, before you pay anything.",
    },
    {
      n: "02",
      title: "Put the code on the tables",
      body: "Print it, drop it in the group chat, or put it on the order of service. Guests point a camera at it - that is the whole instruction.",
    },
    {
      n: "03",
      title: "Keep everything",
      body: "Photos land in one gallery as they arrive. Download the lot as a single ZIP the morning after.",
    },
  ];

  return (
    <section id="how" className="bg-gouda">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 lg:py-24">
        <Eyebrow className="text-crust">How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[2.25rem] sm:text-[4rem]">
          Three things to do, and one of them is printing.
        </h2>

        <ol className="mt-9 grid gap-4 sm:mt-12 sm:gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li
              key={step.n}
              className="rounded-[1.25rem] bg-cream p-5 shadow-md sm:p-6"
            >
              <span className="hole inline-flex h-11 w-11 items-center justify-center font-mono text-[0.8125rem] tracking-[0.1em] text-gouda-light sm:h-12 sm:w-12">
                {step.n}
              </span>
              <h3 className="mt-4 text-h3">{step.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-crust">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
