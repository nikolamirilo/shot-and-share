import { Badge, Eyebrow } from "@/components/ui";
import { KEEPING_NAME } from "@/lib/tiers";

export function PricingDetail() {
  const points: Array<[string, string]> = [
    [
      "Why gigabytes and not a photo count",
      "A count limit punishes anyone with a recent phone and rewards nobody. Storage is what actually costs money, so that is what we count - and it lets us be far more generous for the same spend.",
    ],
    [
      "Why the free plan is properly usable",
      "You cannot judge this product on fifty photos. The thing you most want to test is what happens when a hundred arrive at once, so the free plan lets you do exactly that. It runs one event at a time - upgrade that event or delete it, and the next one is free again.",
    ],
    [
      `Why ${KEEPING_NAME} is billed yearly`,
      "Holding thirty gigabytes has a bill attached every month it is held. The one-off we used to sell could only fund that by moving the files somewhere that takes two days to read - which is not a gallery, it is a box in a warehouse. So the plan is bought once and only the storage recurs, starting when the window you already paid for runs out.",
    ],
    [
      "Why we are not the cheapest",
      "This sits next to a wedding that costs tens of thousands. A price far below the market reads as a hobby project, and this is a product whose entire promise is that it will not lose your memories.",
    ],
  ];

  return (
    <section className="bg-linen">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 lg:py-24">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>The reasoning</Eyebrow>
          <Badge tone="outline">Plans never renew</Badge>
        </div>
        <h2 className="mt-3 max-w-2xl text-[2.25rem] [word-spacing:0.1em] sm:text-[3.5rem]">
          Why the prices are what they are.
        </h2>

        <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 md:grid-cols-2">
          {points.map(([title, body], i) => (
            <div key={title} className="card flex gap-4 p-5 sm:gap-5 sm:p-6">
              <span
                aria-hidden
                className="mt-1 font-mono text-micro tracking-[0.16em] text-mist tabular-nums"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-[1.3rem] tracking-[-0.03em]">{title}</h3>
                <p className="mt-2 text-small leading-relaxed text-ash">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
