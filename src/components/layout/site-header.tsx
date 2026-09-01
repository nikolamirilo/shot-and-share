"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MdClose,
  MdMenu,
  MdOutlineAddCircleOutline,
  MdOutlinePhotoLibrary,
} from "react-icons/md";

import { Wordmark } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui";

export function HeaderShell({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    /* The gutter is the page's, not the header's: every content column in the
       product is `px-4 sm:px-5`, and a header on its own 12px inset below `sm`
       sat a visible 4px wider than the cards underneath it. */
    <header className={`px-4 pt-3 sm:px-5 sm:pt-4 ${className}`}>
      {/* The pill's own padding and gap tighten below `xs`. A 320px phone is
          16px short of holding the dashboard's row at the roomier setting, and
          16px of chrome is a cheaper thing to give up than the label on the one
          button the bar exists for. */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-2xl bg-paper/92 px-3 py-2.5 shadow-sm backdrop-blur xs:gap-3 xs:px-4 sm:gap-4 sm:px-5 sm:py-3">
        {children}
      </div>
    </header>
  );
}

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <HeaderShell className="sticky top-0 z-40">
      <Link href="/" aria-label="Shot & Share, home" className="shrink-0">
        <Wordmark labelClassName="hidden xs:inline" />
      </Link>

      <div className="flex items-center gap-3 sm:hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-9 w-9 items-center justify-center rounded-full text-2xl hover:bg-blush"
        >
          {open ? <MdClose /> : <MdMenu />}
        </button>
      </div>

      <nav className="hidden items-center gap-4 sm:flex sm:gap-5">
        <Link
          href="/#how"
          className="text-[0.9375rem] font-semibold hover:underline"
        >
          How it works
        </Link>
        <Link
          href="/demo"
          className="text-[0.9375rem] font-semibold hover:underline"
        >
          Demo
        </Link>
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

      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl bg-paper/98 shadow-md backdrop-blur sm:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
            <Link
              href="/#how"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-[0.9375rem] font-semibold hover:bg-blush"
            >
              How it works
            </Link>
            <Link
              href="/demo"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-[0.9375rem] font-semibold hover:bg-blush"
            >
              Demo
            </Link>
            <Link
              href="/pricing"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-[0.9375rem] font-semibold hover:bg-blush"
            >
              Pricing
            </Link>
            <div className="mt-2">
              <ButtonLink
                href={signedIn ? "/dashboard" : "/login"}
                size="sm"
                variant="primary"
                className="px-3 py-2"
                onClick={() => setOpen(false)}
              >
                {signedIn ? (
                  <MdOutlinePhotoLibrary aria-hidden className="shrink-0 text-[1.25em]" />
                ) : (
                  <MdOutlineAddCircleOutline aria-hidden className="shrink-0 text-[1.25em]" />
                )}
                {signedIn ? "My events" : "Create an event"}
              </ButtonLink>
            </div>
          </nav>
        </div>
      )}
    </HeaderShell>
  );
}
