import Link from "next/link";

import { LogoMark } from "@/components/layout/Logo";
import { LottiePlayer } from "@/components/marketing/LottiePlayer";
import markOnClaret from "@/components/marketing/lottie/markOnClaret.json";
import { ButtonLink, FreeTag } from "@/components/ui";

export function ClosingCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-claret text-chalk">
      <div
        id="closing"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-5 px-4 py-8 sm:px-5 sm:py-9"
      >
        <LottiePlayer data={markOnClaret} rest={95} once className="h-14 w-14 shrink-0">
          <LogoMark variant="reversed" className="h-full w-full" />
        </LottiePlayer>
        <div className="min-w-0 flex-[1_1_18rem]">
          <h2 className="text-[1.875rem] [word-spacing:0.1em] sm:text-[2.5rem]">
            Set it up tonight. Free to try.
          </h2>
          <p className="mt-2 font-mono text-micro uppercase tracking-[0.16em] text-chalk/72">
            No card · About a minute
          </p>
        </div>
        <div
          id="closing-ctas"
          className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6"
        >
          <ButtonLink
            href={signedIn ? "/dashboard" : "/signup"}
            size="lg"
            variant="onDark"
            className="w-full sm:w-auto"
          >
            Create your event
            <FreeTag />
          </ButtonLink>
          <Link
            href="/pricing"
            className="inline-flex min-h-12 items-center justify-center font-semibold underline decoration-2 underline-offset-4 decoration-chalk/45 hover:decoration-chalk"
          >
            Compare plans
          </Link>
        </div>
      </div>
    </section>
  );
}
