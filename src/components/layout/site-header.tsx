"use client";

import Link from "next/link";
import {
  MdOutlineAddCircleOutline,
  MdOutlinePhotoLibrary,
} from "react-icons/md";

import { Wordmark } from "@/components/layout/logo";
import { MobileMenu } from "@/components/layout/mobile-menu";
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

/** The marketing pages' own links, in the order they are read. */
const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/demo", label: "Demo" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const cta = {
    href: signedIn ? "/dashboard" : "/login",
    label: signedIn ? "My events" : "Create an event",
    icon: signedIn ? MdOutlinePhotoLibrary : MdOutlineAddCircleOutline,
  };
  const CtaIcon = cta.icon;

  return (
    <HeaderShell className="sticky top-0 z-40">
      <Link href="/" aria-label="Shot & Share, home" className="shrink-0">
        <Wordmark labelClassName="hidden xs:inline" />
      </Link>

      <nav className="hidden items-center gap-4 sm:flex sm:gap-5">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-[0.9375rem] font-semibold hover:underline"
          >
            {item.label}
          </Link>
        ))}
        <ButtonLink
          href={cta.href}
          size="sm"
          variant="primary"
          className="whitespace-nowrap"
        >
          <CtaIcon aria-hidden className="shrink-0 text-[1.25em]" />
          {cta.label}
        </ButtonLink>
      </nav>

      {/* Below `sm` the same links and the same call to action, all of them
          inside the one menu rather than half on the bar beside it. */}
      <MobileMenu
        className="sm:hidden"
        items={[
          ...NAV.map((item) => ({
            key: item.href,
            render: (close: () => void) => (
              <Link
                href={item.href}
                onClick={close}
                /* Full width so the whole row is the tap target, and no
                   horizontal padding of its own: the label ends on the same
                   edge as the account name above it and the button below. */
                className="w-full py-2.5 text-right text-[0.9375rem] font-semibold hover:underline"
              >
                {item.label}
              </Link>
            ),
          })),
          {
            key: "cta",
            className: "mt-2",
            render: (close: () => void) => (
              <ButtonLink
                href={cta.href}
                size="sm"
                variant="primary"
                className="whitespace-nowrap"
                onClick={close}
              >
                <CtaIcon aria-hidden className="shrink-0 text-[1.25em]" />
                {cta.label}
              </ButtonLink>
            ),
          },
        ]}
      />
    </HeaderShell>
  );
}
