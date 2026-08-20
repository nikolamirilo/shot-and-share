import Link from "next/link";
import {
  MdOutlineAddCircleOutline,
  MdOutlinePhotoLibrary,
} from "react-icons/md";

import { Wordmark } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui";

/**
 * The navigation floats: a card held clear of the edges rather than a bar
 * welded to the top, so the hero's colour runs to the top of the window behind
 * it. The dashboard's header is the same object with different things in it.
 *
 * `className` carries only how it sits in the page. The marketing one is
 * `sticky` rather than `fixed`, so it keeps its space in the flow; the
 * dashboard's stays in flow because the panels under it pin themselves to the
 * viewport and would slide underneath a header that followed them down.
 */
export function HeaderShell({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <header className={`px-3 pt-3 sm:px-5 sm:pt-4 ${className}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl bg-paper/92 px-4 py-2.5 shadow-sm backdrop-blur sm:gap-4 sm:px-5 sm:py-3">
        {children}
      </div>
    </header>
  );
}

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <HeaderShell className="sticky top-0 z-40">
      <Link href="/" aria-label="Shot & Share, home" className="shrink-0">
        <Wordmark labelClassName="hidden xs:inline" />
      </Link>

      <nav className="flex items-center gap-4 sm:gap-5">
        <Link
          href="/#how"
          className="hidden text-[0.9375rem] font-semibold hover:underline sm:block"
        >
          How it works
        </Link>
        {/* Ahead of Pricing, and it keeps its place down to the same width.
            Somebody who has not worked out what this is yet should be able to
            meet the product before the price list, and until this existed the
            only way in was a sign-in form. */}
        <Link
          href="/demo"
          className="text-[0.9375rem] font-semibold hover:underline"
        >
          Demo
        </Link>
        {/* Pricing survives to the smallest screen where "How it works" does
            not. It is the question a visitor on a phone actually has, and the
            landing page repeats how it works three sections in. */}
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
          {signedIn ? (
            <MdOutlinePhotoLibrary aria-hidden className="shrink-0 text-[1.25em]" />
          ) : (
            <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
          )}
          {signedIn ? "My events" : "Create an event"}
        </ButtonLink>
      </nav>
    </HeaderShell>
  );
}
