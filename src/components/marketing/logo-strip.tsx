import { Hole } from "@/components/ui";

/**
 * The only break between the yellows. It exists so the Butter hero and the
 * Gouda band underneath do not blur into each other.
 */
export function LogoStrip() {
  const facts = [
    ["No app", "Opens in the phone's browser"],
    ["No account", "Guests never sign in"],
    ["No hunting", "Everything in one gallery"],
  ];

  return (
    <section className="bg-pepper text-butter">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-7 sm:grid-cols-3 sm:gap-6 sm:px-5 sm:py-8">
        {facts.map(([title, detail]) => (
          <div key={title} className="flex items-start gap-3">
            <Hole size={14} className="mt-1.5" />
            <div>
              <p className="font-display text-[1.3rem] font-extrabold tracking-[-0.03em]">
                {title}
              </p>
              <p className="text-[0.9375rem] text-butter/70">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
