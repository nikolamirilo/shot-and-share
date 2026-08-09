import Link from "next/link";

import { Wordmark } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-40 bg-butter/92 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
        <Link href="/" aria-label="Say Cheese, home" className="shrink-0">
          <Wordmark labelClassName="hidden xs:inline" />
        </Link>

        <nav className="flex items-center gap-4 sm:gap-5">
          <Link
            href="/#how"
            className="hidden text-[0.9375rem] font-semibold hover:underline sm:block"
          >
            How it works
          </Link>
          {/* Pricing survives to the smallest screen where "How it works" does
              not. It is the question a visitor on a phone actually has, and
              the landing page repeats how it works three sections in. */}
          <Link
            href="/pricing"
            className="text-[0.9375rem] font-semibold hover:underline"
          >
            Pricing
          </Link>
          <ButtonLink
            href={signedIn ? "/dashboard" : "/login"}
            size="sm"
            variant="primary"
            className="whitespace-nowrap"
          >
            {signedIn ? "My events" : "Create an event"}
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
