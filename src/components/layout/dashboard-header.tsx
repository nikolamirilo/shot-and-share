"use client";

import Link from "next/link";
import { useState } from "react";
import { MdAdd, MdClose, MdMenu } from "react-icons/md";

import { AccountMenu } from "@/components/layout/account-menu";
import { Wordmark } from "@/components/layout/logo";
import { HeaderShell } from "@/components/layout/site-header";
import { ButtonLink, cx } from "@/components/ui";

/**
 * Everything the phone menu would hold, minus the "New event" button - that one
 * is on the bar at every width, and a menu that repeats the button beside it is
 * a menu with nothing of its own to say.
 *
 * The length of this list is what decides whether there is a hamburger at all.
 */
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
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * A menu holding one thing is a tap in front of the thing. At one item the
   * item goes straight on the bar and no hamburger is drawn; from two it is
   * worth folding away again. The bar has room for it because the wordmark
   * drops to its mark below `sm` and the pill's own padding tightens below `xs`.
   */
  const collapsed = NAV.length <= 1;

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
          <Wordmark labelClassName="hidden sm:inline" />
        </Link>

        {/* `min-w-0` so the one thing here that can give - the account name -
            is the thing that gives, rather than the row overflowing. */}
        <div className="flex min-w-0 items-center gap-2 xs:gap-2.5 sm:gap-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "shrink-0 whitespace-nowrap text-[0.9375rem] font-semibold hover:underline",
                // Folded into the hamburger below `sm` only while there is one.
                collapsed ? "inline" : "hidden sm:inline",
              )}
            >
              {item.label}
            </Link>
          ))}

          <ButtonLink
            href="/dashboard/events/new"
            size="sm"
            aria-label="New event"
            className="shrink-0 whitespace-nowrap"
          >
            <MdAdd aria-hidden className="shrink-0 text-[1.25em]" />
            {/* Measured rather than chosen: the row needs 344px of viewport to
                hold this label beside "My events" and the account badge, so it
                goes at 352 with a little to spare. `xs` would have taken it off
                every phone up to 480, and icon-only it is a claret pill beside
                a claret avatar - two circles, neither obviously the button.
                `aria-label` above names it either way. */}
            <span className="hidden min-[22rem]:inline">New event</span>
          </ButtonLink>

          {!collapsed && (
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-blush sm:hidden"
            >
              {menuOpen ? <MdClose /> : <MdMenu />}
            </button>
          )}

          {/* With no hamburger to hold it, the account comes out onto the bar at
              every width - otherwise signing out would need a laptop.

              `min-w-10` is the face's own width. The name beside it may be
              squeezed away, the face may not, and the face is `shrink-0`, so
              without a floor here it is pushed straight out of the pill. */}
          <div className={cx("min-w-10", !collapsed && "hidden sm:block")}>
            <AccountMenu
              name={name}
              email={email}
              avatarUrl={avatarUrl}
              showName="wide"
            />
          </div>
        </div>
      </HeaderShell>

      {!collapsed && menuOpen && (
        /* Inset by the same amount as the header's own pill, so the panel lines
           up under it rather than running edge to edge. Everything inside is
           set to the right, under the button that opened it. */
        <div className="absolute inset-x-4 top-full z-40 mt-2 rounded-2xl bg-paper/98 shadow-md backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-6xl flex-col items-end gap-3 px-4 py-4 text-right">
            <div className="flex w-full justify-end border-b border-edge pb-3">
              <AccountMenu
                name={name}
                email={email}
                avatarUrl={avatarUrl}
                showName
              />
            </div>
            <nav className="flex flex-col items-end gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-[0.9375rem] font-semibold hover:bg-blush"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
