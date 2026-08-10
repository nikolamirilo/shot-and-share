import Link from "next/link";

import { ButtonLink } from "@/components/ui";

/**
 * The one saturated band on the page.
 *
 * Claret is spent twice on the landing page - on the button in the hero and on
 * this - and nowhere in between, which is what keeps it meaning "press this"
 * rather than "brand colour". On the wine the filled button has to be the light
 * shape, and the second choice steps down to a plain underlined link: two
 * competing fills here would read as two equal offers, and they are not.
 */
export function ClosingCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-claret text-chalk">
      <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-5 sm:py-20 lg:py-28">
        <h2 className="text-[2.25rem] sm:text-[4rem]">
          Set it up tonight. It costs nothing to try.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-body text-chalk/75 sm:text-lead">
          Make the event, print the code, send the link to one friend and watch
          a photo arrive. Then decide whether to pay.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:gap-4">
          <ButtonLink
            href={signedIn ? "/dashboard" : "/login"}
            size="lg"
            variant="onDark"
            className="w-full sm:w-auto"
          >
            Create an event
          </ButtonLink>
          <Link
            href="/pricing"
            className="inline-flex min-h-12 items-center justify-center font-semibold underline decoration-2 underline-offset-4 decoration-chalk/45 hover:decoration-chalk"
          >
            Compare the plans
          </Link>
        </div>
      </div>
    </section>
  );
}
