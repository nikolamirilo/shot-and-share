import { Eyebrow, Hole } from "@/components/ui";
import { FAQS } from "@/lib/faqs";

export function Faq() {
  return (
    <section id="faq" className="bg-linen">
      <div className="mx-auto max-w-3xl px-4 pb-14 pt-12 sm:px-5 sm:pb-20 sm:pt-16">
        <Eyebrow>Questions</Eyebrow>
        <h2 className="mt-3 text-[2.25rem] sm:text-h1">Before you ask.</h2>

        {/* Ruled rows before, stacked cards now. A question is its own object
            once there is no line penning it in, so each one gets a surface and
            the gaps between them do the dividing. */}
        <div className="mt-8 space-y-2.5 sm:mt-10">
          {FAQS.map(([q, a]) => (
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
