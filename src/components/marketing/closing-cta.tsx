import Link from "next/link";
import { MdOutlineAddCircleOutline } from "react-icons/md";

import { LogoMark } from "@/components/layout/logo";
import { LottiePlayer } from "@/components/marketing/lottie-player";
import markOnClaret from "@/components/marketing/lottie/markOnClaret.json";
import { ButtonLink } from "@/components/ui";

/**
 * The one saturated band on the page. Claret is spent twice on the landing page
 * and nowhere in between, which keeps it meaning "press this" rather than
 * "brand colour". The second choice is a plain link: two competing fills would
 * read as two equal offers.
 *
 * The mark builds itself once as the band scrolls in: the brand's one drawn
 * object, animated once, as the page ends.
 */
export function ClosingCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-claret text-chalk">
      <div id="closing" className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-5 sm:py-20 lg:py-28">
        <LottiePlayer data={markOnClaret} rest={95} once className="mx-auto mb-6 h-22 w-22">
          <LogoMark variant="reversed" className="h-full w-full" />
        </LottiePlayer>
        <h2 className="text-[2.25rem] [word-spacing:0.1em] sm:text-[4rem]">
          Set it up tonight. It costs nothing to try.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-body text-chalk/75 sm:text-lead">
          Make the event, print the code, send the link to one friend and watch
          a photo arrive. Then decide whether to pay.
        </p>
        <div id="closing-ctas" className="mt-8 flex flex-col justify-center gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:gap-4">
          <ButtonLink
            href={signedIn ? "/dashboard" : "/login"}
            size="lg"
            variant="onDark"
            className="w-full sm:w-auto"
          >
            <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
            Create your free event
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
