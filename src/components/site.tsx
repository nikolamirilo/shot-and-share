import Link from "next/link";

import { LogoMark, Wordmark } from "@/components/logo";
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

export function SiteFooter() {
  return (
    <footer className="bg-pepper text-butter">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-9 px-4 py-12 sm:grid-cols-[1.3fr_1fr_1fr] sm:gap-10 sm:px-5 sm:py-14">
        {/* Two columns of links side by side on a phone rather than three
            stacked blocks: it halves the scroll and the columns are short. */}
        <div className="col-span-2 sm:col-span-1">
          <span className="inline-flex items-center gap-2.5">
            <LogoMark variant="reversed" className="h-9 w-auto" />
            <span
              className="font-display text-[1.35rem] font-extrabold tracking-[-0.04em]"
              style={{ fontStretch: "86%" }}
            >
              Say Cheese
            </span>
          </span>
          <p className="mt-3 max-w-xs text-[0.9375rem] text-butter/75">
            Every photo from every guest, at any event.
          </p>
        </div>

        <FooterColumn
          title="Product"
          links={[
            ["How it works", "/#how"],
            ["Pricing", "/pricing"],
            ["Questions", "/#faq"],
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            ["Terms", "/legal/terms"],
            ["Privacy", "/legal/privacy"],
            ["Contact", "mailto:hello@saycheese.app"],
          ]}
        />
      </div>

      {/* A shadow falls on nothing at this end of the page, so the colophon is
          divided off by sinking a shade rather than by a rule. */}
      <div className="bg-black/15">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-butter/55 sm:px-5">
          © {new Date().getFullYear()} Say Cheese
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<[string, string]>;
}) {
  return (
    <div>
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-gouda">
        {title}
      </p>
      <ul className="mt-3 space-y-1">
        {links.map(([label, href]) => (
          <li key={label}>
            {/* Inline-block with vertical padding rather than a bare link:
                a footer link on a phone is a thumb target, not a word. */}
            <Link
              href={href}
              className="inline-block py-1 text-[0.9375rem] text-butter/80 hover:text-butter hover:underline"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
