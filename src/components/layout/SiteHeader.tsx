"use client";

import Link from "next/link";
import { BsRocketTakeoff } from "react-icons/bs";
import { AccountMenu, SignOutButton } from "@/components/layout/AccountMenu";
import { Wordmark } from "@/components/layout/Logo";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { ButtonLink } from "@/components/ui";
import { LuCalendarFold } from "react-icons/lu";

export function HeaderShell({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <header className={`px-4 pt-3 sm:px-5 sm:pt-4 ${className}`}>
      {/* `relative` so the phone menu panel measures its width off the bar,
          not the full-bleed header. */}
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-2xl bg-paper px-3 py-2.5 shadow-sm xs:gap-3 xs:px-4 sm:gap-4 sm:px-5 sm:py-3">
        {children}
      </div>
    </header>
  );
}

export type HeaderUser = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * One header for every page, dashboard included. Signed in you get My events
 * plus the account badge; signed out, a single Get Started.
 */
export function SiteHeader({ user = null }: { user?: HeaderUser | null }) {
  const cta = user
    ? { href: "/dashboard", label: "My events", icon: LuCalendarFold }
    : { href: "/signup", label: "Get Started", icon: BsRocketTakeoff };
  const CtaIcon = cta.icon;

  const ctaButton = (close: () => void) => (
    <ButtonLink
      href={cta.href}
      size="sm"
      variant="primary"
      onClick={close}
      className="shrink-0 whitespace-nowrap"
    >
      <CtaIcon aria-hidden className="shrink-0 text-[1.25em]" />
      {cta.label}
    </ButtonLink>
  );

  return (
    <HeaderShell className="sticky top-0 z-40">
      <Link
        href="/"
        aria-label="Shot & Share, home"
        className="flex shrink-0 items-center"
      >
        <Wordmark />
      </Link>

      <nav className="hidden min-w-0 items-center gap-5 md:flex">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 whitespace-nowrap text-small font-semibold transition-colors duration-200 hover:text-claret"
          >
            {item.label}
          </Link>
        ))}

        {ctaButton(() => {})}

        {/* `min-w-10` keeps the badge round while the name ellipsises. */}
        {user && (
          <div className="min-w-10">
            <AccountMenu
              name={user.name}
              email={user.email}
              avatarUrl={user.avatarUrl}
              showName="wide"
            />
          </div>
        )}
      </nav>

      {/* Links, then the CTA, then the way out, then who you are. */}
      <MobileMenu
        className="md:hidden"
        items={[
          ...NAV.map((item) => ({
            key: item.href,
            render: (close: () => void) => (
              <Link
                href={item.href}
                onClick={close}
                className="w-full py-2.5 text-right text-small font-semibold transition-colors duration-200 hover:text-claret"
              >
                {item.label}
              </Link>
            ),
          })),
          ...(user
            ? []
            : [
                {
                  key: "signin",
                  render: (close: () => void) => (
                    <Link
                      href="/login"
                      onClick={close}
                      className="w-full py-2.5 text-right text-small font-semibold transition-colors duration-200 hover:text-claret"
                    >
                      Sign in
                    </Link>
                  ),
                },
              ]),
          { key: "cta", className: "mt-2", render: ctaButton },
          ...(user
            ? [
                {
                  key: "signout",
                  className: "mt-2",
                  render: () => <SignOutButton variant="secondary" />,
                },
                {
                  key: "account",
                  className: "mt-3",
                  render: () => (
                    <AccountMenu
                      name={user.name}
                      email={user.email}
                      avatarUrl={user.avatarUrl}
                      showName
                      interactive={false}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </HeaderShell>
  );
}
