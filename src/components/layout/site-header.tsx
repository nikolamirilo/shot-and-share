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
    <header className={`px-3 pt-3 sm:px-5 sm:pt-4 ${className}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl bg-paper/92 px-4 py-2.5 shadow-sm backdrop-blur sm:gap-4 sm:px-5 sm:py-3">
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
          className="flex h-9 w-9 items-center justify-center rounded-full text-2xl hover:bg-sand"
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
              className="rounded-lg px-3 py-2 text-[0.9375rem] font-semibold hover:bg-sand"
            >
              How it works
            </Link>
            <Link
              href="/demo"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-[0.9375rem] font-semibold hover:bg-sand"
            >
              Demo
            </Link>
            <Link
              href="/pricing"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-[0.9375rem] font-semibold hover:bg-sand"
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
