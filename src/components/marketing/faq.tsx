import { Eyebrow, Hole } from "@/components/ui";

export function Faq() {
  const faqs = [
    [
      "Do guests need an account?",
      "No. They open the link, choose photos and upload. There is no sign-in prompt anywhere on the guest side, on purpose - it is the single biggest reason people fail to hand over their photos.",
    ],
    [
      "What happens when the storage window ends?",
      "You get emails 14, 7 and 1 days before. When it ends the event is paused rather than deleted, and stays restorable for another 14 days. Add The Archive at any point and nothing is ever removed.",
    ],
    [
      "Can I stop people uploading?",
      "Yes. Revoke the link from your dashboard and it stops working immediately. You can issue a fresh one for the people who should still have it.",
    ],
    [
      "How many photos actually fit?",
      "Roll holds about 2,500 and Reel about 7,500, based on a 4 MB photo. Modern phones vary, which is exactly why the limit is in gigabytes rather than a photo count.",
    ],
    [
      "Can guests see the photos everyone else uploaded?",
      "That is your choice per event. The shared gallery is on by default because guests like seeing the night from other people's phones, and you can turn it off.",
    ],
    [
      "Is video included?",
      "On the paid plans, up to 200 MB a clip. The free plan is photos only: one large video can eat the entire free allowance, which would make the free plan useless for what it is meant to prove.",
    ],
  ];

  return (
    <section id="faq" className="bg-linen">
      <div className="mx-auto max-w-3xl px-4 pb-14 pt-12 sm:px-5 sm:pb-20 sm:pt-16">
        <Eyebrow>Questions</Eyebrow>
        <h2 className="mt-3 text-[2.25rem] sm:text-h1">Before you ask.</h2>

        {/* Ruled rows before, stacked cards now. A question is its own object
            once there is no line penning it in, so each one gets a surface and
            the gaps between them do the dividing. */}
        <div className="mt-8 space-y-2.5 sm:mt-10">
          {faqs.map(([q, a]) => (
            <details key={q} className="card group px-4 py-1 sm:px-5">
              {/* The padding is on the summary, not the details, so the whole
                  strip is the tap target rather than the words alone. */}
              <summary className="flex cursor-pointer list-none items-start gap-3 py-4 text-[1.15rem] font-extrabold leading-snug tracking-[-0.03em] marker:hidden sm:text-[1.3rem]">
                <Hole
                  size={13}
                  className="mt-1.5 transition-transform group-open:scale-150"
                />
                {q}
              </summary>
              <p className="pb-4 pl-6 text-[0.9375rem] leading-relaxed text-ash">
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
