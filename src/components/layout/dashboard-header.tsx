"use client";

import Link from "next/link";
import { MdAdd } from "react-icons/md";

import { AccountMenu } from "@/components/layout/account-menu";
import { Wordmark } from "@/components/layout/logo";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { HeaderShell } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui";

/** The dashboard's own links. The account and "New event" are separate, below. */
const NAV = [{ href: "/dashboard", label: "My events" }];

export function DashboardHeader({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}) {
  const newEvent = (close: () => void) => (
    <ButtonLink
      href="/dashboard/events/new"
      size="sm"
      onClick={close}
      className="shrink-0 whitespace-nowrap"
    >
      <MdAdd aria-hidden className="shrink-0 text-[1.25em]" />
      New event
    </ButtonLink>
  );

  return (
    /**
     * The wrapper is what the dropdown hangs off. It used to be a fragment, so
     * `top-full` on the panel had no positioned ancestor to resolve against and
     * fell back to the viewport: opening the menu on a phone put it one whole
     * screen further down the page, which reads as the button doing nothing.
     */
    <div className="relative z-30">
      <HeaderShell className="relative z-10">
        <Link href="/" aria-label="Shot & Share, home" className="flex shrink-0 items-center">
          <Wordmark labelClassName="hidden xs:inline" />
        </Link>

        {/* `min-w-0` so the one thing here that can give - the account name -
            is the thing that gives, rather than the row overflowing. */}
        <div className="hidden min-w-0 items-center gap-4 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 whitespace-nowrap text-[0.9375rem] font-semibold hover:underline"
            >
              {item.label}
            </Link>
          ))}

          {newEvent(() => {})}

          {/* `min-w-10` is the face's own width. The name beside it may be
              squeezed away, the face may not, and the face is `shrink-0`, so
              without a floor here it is pushed straight out of the pill. */}
          <div className="min-w-10">
            <AccountMenu
              name={name}
              email={email}
              avatarUrl={avatarUrl}
              showName="wide"
            />
          </div>
        </div>

        {/* Below `sm` all three go into the one menu - the account, the links
            and the call to action alike. Three of them side by side on a phone
            filled the pill edge to edge and left the wordmark nowhere to go. */}
        <MobileMenu
          className="sm:hidden"
          items={[
            {
              key: "account",
              /* No `close`: the badge opens a panel of its own, and a menu
                 that shut itself on the way would take that panel with it. */
              render: () => (
                <AccountMenu
                  name={name}
                  email={email}
                  avatarUrl={avatarUrl}
                  showName
                />
              ),
            },
            ...NAV.map((item) => ({
              key: item.href,
              render: (close: () => void) => (
                <Link
                  href={item.href}
                  onClick={close}
                  /* Full width so the whole row is the tap target, and flush
                     right with the account name above and the button below. */
                  className="w-full py-2.5 text-right text-[0.9375rem] font-semibold hover:underline"
                >
                  {item.label}
                </Link>
              ),
            })),
            { key: "new-event", className: "mt-2", render: newEvent },
          ]}
        />
      </HeaderShell>
    </div>
  );
}
