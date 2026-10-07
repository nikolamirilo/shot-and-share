import { Eyebrow } from "@/components/ui";
import { EXAMPLE_REVIEWS, REVIEWS } from "@/lib/reviews";

/**
 * What hosts say, right before the price.
 *
 * Renders real reviews when there are any. With none, development shows the
 * example set with a line saying so, and production renders nothing at all -
 * see lib/reviews.ts for why.
 */
export function Proof() {
  const examples = REVIEWS.length === 0;
  if (examples && process.env.NODE_ENV === "production") return null;
  const reviews = examples ? EXAMPLE_REVIEWS : REVIEWS;

  return (
    <section className="bg-blush">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20 lg:py-24">
        <Eyebrow>From hosts</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[2.25rem] [word-spacing:0.1em] sm:text-[3.5rem]">
          What hosts say the morning after.
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
          {reviews.map((r) => (
            <figure key={r.name} className="card flex flex-col gap-4 p-6">
              <p
                aria-label={`${r.stars} out of 5`}
                className="text-[1rem] leading-none tracking-[0.12em] text-ink"
              >
                {"★".repeat(r.stars)}
                <span className="text-edge">{"★".repeat(5 - r.stars)}</span>
              </p>
              <blockquote className="flex-1 text-[1.125rem] font-medium leading-normal [text-wrap:pretty]">
                {r.text}
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="hole grid h-11 w-11 place-items-center font-mono text-[0.75rem] tracking-[0.06em] text-rose-soft"
                >
                  {r.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")}
                </span>
                <span>
                  <b className="block text-[0.9375rem] leading-snug">{r.name}</b>
                  <span className="block text-label text-ash">{r.meta}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        {examples && (
          <p className="mt-4 text-label text-ash">
            Example reviews, shown in development only. Add real ones in lib/reviews.ts.
          </p>
        )}
      </div>
    </section>
  );
}
