import { Badge, Eyebrow } from "@/components/ui";

export function PricingDetail() {
  const points: Array<[string, string]> = [
    [
      "Why gigabytes and not a photo count",
      "A count limit punishes anyone with a recent phone and rewards nobody. Storage is what actually costs money, so that is what we count - and it lets us be far more generous for the same spend.",
    ],
    [
      "Why the free plan is properly usable",
      "You cannot judge this product on fifty photos. The thing you most want to test is what happens when a hundred arrive at once, so the free plan lets you do exactly that.",
    ],
    [
      "Why Keep Forever is not a subscription",
      "A wedding happens once. An annual charge for storage is the wrong shape for it: people forget, cards expire, and one day the photos are gone. €29, paid once, and they stay.",
    ],
    [
      "Why we are not the cheapest",
      "This sits next to a wedding that costs tens of thousands. A price far below the market reads as a hobby project, and this is a product whose entire promise is that it will not lose your memories.",
    ],
  ];

  return (
    <section className="bg-butter">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-5 sm:py-16">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>The reasoning</Eyebrow>
          <Badge tone="outline">No subscription anywhere</Badge>
        </div>

        <div className="mt-8 grid gap-x-10 gap-y-8 sm:mt-9 sm:grid-cols-2">
          {points.map(([title, body]) => (
            <div key={title}>
              <h3 className="text-[1.3rem] font-extrabold tracking-[-0.03em]">
                {title}
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-crust">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
