import { Eyebrow, Hole } from "@/components/ui";

export function Why() {
  const items = [
    {
      title: "The guest side is one screen",
      body: "Open, choose photos, done. Every sign-in prompt is a guest who does not upload, so there are none.",
    },
    {
      title: "Gigabytes, not photo counts",
      body: "A photo limit punishes anyone with a recent phone. We count storage, which is what actually costs money, and it lets us be far more generous.",
    },
    {
      title: "Nothing is deleted quietly",
      body: "Warnings go out at 14, 7 and 1 days. After that the event is paused, not erased, and stays restorable for two more weeks.",
    },
    {
      title: "Keep them forever for €29, once",
      body: "Not a subscription. People plan one wedding, not twelve, and asking them to remember to cancel something afterwards is a bad experience.",
    },
    {
      title: "You can shut the link off",
      body: "If a link ends up somewhere it should not be, revoke it. It stops working immediately and you can issue a new one.",
    },
    {
      title: "Live slideshow on the night",
      body: "Point a laptop at the projector and photos appear as guests upload them. On the Reel plan, no venue software needed.",
    },
  ];

  return (
    <section className="bg-linen">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 lg:py-24">
        <Eyebrow>Why this one</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[2.25rem] sm:text-h1">
          Built for the person who has to collect them afterwards.
        </h2>

        <div className="mt-9 grid gap-x-10 gap-y-8 sm:mt-12 sm:grid-cols-2 sm:gap-y-9 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.title}>
              <div className="flex items-center gap-3">
                <Hole size={13} />
                <h3 className="text-[1.3rem] font-extrabold tracking-[-0.03em]">
                  {item.title}
                </h3>
              </div>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-ash">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
