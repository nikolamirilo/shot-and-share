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
    <>
      <HeaderShell className="relative z-10">
        <Link href="/" aria-label="Shot & Share, home" className="shrink-0">
          <Wordmark labelClassName="hidden xs:inline" />
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/dashboard"
            className="hidden whitespace-nowrap text-[0.9375rem] font-semibold hover:underline xs:inline"
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
            className="flex h-9 w-9 items-center justify-center rounded-full text-2xl hover:bg-sand sm:hidden"
          >
            {menuOpen ? <MdClose /> : <MdMenu />}
          </button>
          <div className="hidden sm:block">
            <AccountMenu name={name} email={email} avatarUrl={avatarUrl} />
          </div>
        </div>
      </HeaderShell>

      {menuOpen && (
        <div className="absolute left-3 right-3 z-40 mx-auto max-w-6xl rounded-2xl bg-paper/98 px-4 py-4 shadow-md backdrop-blur sm:hidden">
          <div className="mb-3 flex items-center gap-3 border-b border-sand pb-3">
            <AccountMenu name={name} email={email} avatarUrl={avatarUrl} />
          </div>
          <nav className="flex flex-col gap-1">
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-[0.9375rem] font-semibold hover:bg-sand"
            >
              My events
            </Link>
            <div className="mt-2">
              <ButtonLink
                href="/dashboard/events/new"
                size="sm"
                className="w-full justify-center"
                onClick={() => setMenuOpen(false)}
              >
                <MdAdd aria-hidden className="shrink-0 text-[1.25em]" />
                New event
              </ButtonLink>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
