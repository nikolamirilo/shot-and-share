"use client";

import Link from "next/link";
import { useState } from "react";
import { MdAdd, MdClose, MdMenu } from "react-icons/md";

import { AccountMenu } from "@/components/layout/account-menu";
import { Wordmark } from "@/components/layout/logo";
import { HeaderShell } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui";

export function DashboardHeader({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    /**
     * The wrapper is what the dropdown hangs off. It used to be a fragment, so
     * `top-full` on the panel had no positioned ancestor to resolve against and
     * fell back to the viewport: opening the menu on a phone put it one whole
     * screen further down the page, which reads as the button doing nothing.
     */
    <div className="relative z-30">
      <HeaderShell className="relative z-10">
        <Link href="/" aria-label="Shot & Share, home" className="shrink-0">
          <Wordmark labelClassName="hidden xs:inline" />
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* `sm`, not `xs`: below `sm` the hamburger is on the row and its
              panel already lists "My events", so an `xs:inline` copy of it here
              only crowded the row until it overflowed the phone. */}
          <Link
            href="/dashboard"
            className="hidden whitespace-nowrap text-[0.9375rem] font-semibold hover:underline sm:inline"
          >
            My events
          </Link>
          <ButtonLink
            href="/dashboard/events/new"
            size="sm"
            className="whitespace-nowrap"
          >
            <MdAdd aria-hidden className="shrink-0 text-[1.25em]" />
            New event
          </ButtonLink>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-blush sm:hidden"
          >
            {menuOpen ? <MdClose /> : <MdMenu />}
          </button>
          <div className="hidden sm:block">
            <AccountMenu name={name} email={email} avatarUrl={avatarUrl} />
          </div>
        </div>
      </HeaderShell>

      {menuOpen && (
        /* Inset by the same amount as the header's own pill, so the panel lines
           up under it rather than running edge to edge. */
        <div className="absolute inset-x-4 top-full z-40 mt-2 rounded-2xl bg-paper/98 shadow-md backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-4">
            <div className="mb-3 flex items-center gap-3 border-b border-edge pb-3">
              <AccountMenu
                name={name}
                email={email}
                avatarUrl={avatarUrl}
                align="left"
              />
            </div>
            <nav className="flex flex-col gap-1">
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-[0.9375rem] font-semibold hover:bg-blush"
              >
                My events
              </Link>
              <div className="mt-2">
                <ButtonLink
                  href="/dashboard/events/new"
                  size="sm"
                  className="px-3 py-2"
                  onClick={() => setMenuOpen(false)}
                >
                  <MdAdd aria-hidden className="shrink-0 text-[1.25em]" />
                  New event
                </ButtonLink>
              </div>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
