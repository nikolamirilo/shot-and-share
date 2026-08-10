/**
 * The one dark band near the top of the page.
 *
 * It exists so the hero and the section under it do not blur into one long
 * light page, and it says the three things a visitor is actually deciding
 * about. The markers are claret rather than a punched well: on ink a well is
 * invisible, and these are the only three claims on the page that get a mark.
 */
export function LogoStrip() {
  const facts = [
    ["No app", "Opens in the phone's browser"],
    ["No account", "Guests never sign in"],
    ["No hunting", "Everything in one gallery"],
  ];

  return (
    <section className="bg-ink text-linen">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-7 sm:grid-cols-3 sm:gap-6 sm:px-5 sm:py-8">
        {facts.map(([title, detail]) => (
          <div key={title} className="flex items-start gap-3">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-rose" />
            <div>
              <p className="font-display text-[1.3rem] font-extrabold tracking-[-0.03em]">
                {title}
              </p>
              <p className="text-[0.9375rem] text-linen/70">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
