/**
 * The one dark band near the top, so the hero and the section under it do not
 * blur into one long light page. The markers are claret rather than a punched
 * well, which on ink would be invisible.
 */
export function LogoStrip() {
  /* The four things every host asks before trusting their guests with it. */
  const facts = [
    ["No app", "Opens in the phone's browser, straight from the camera."],
    ["No guest accounts", "Nobody signs up, logs in or gives an email."],
    ["Every phone", "iPhone and Android, at full resolution."],
    ["Pay once", "The plan never renews, and a 14-day refund."],
  ];

  return (
    <section className="bg-ink text-linen">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-7 sm:grid-cols-2 sm:gap-x-7 sm:gap-y-5 lg:grid-cols-4 sm:px-5 sm:py-8">
        {facts.map(([title, detail]) => (
          <div key={title} className="flex items-start gap-3">
            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-rose" />
            <div>
              <p className="font-display text-[1.3rem] font-extrabold tracking-[-0.03em] [word-spacing:0.1em]">
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
