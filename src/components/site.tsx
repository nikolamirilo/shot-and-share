import Link from "next/link";

import { LogoMark, Wordmark } from "@/components/logo";
import { ButtonLink } from "@/components/ui";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-pepper bg-butter/92 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" aria-label="Say Cheese, home">
          <Wordmark />
        </Link>

        <nav className="flex items-center gap-5">
          <Link
            href="/#how"
            className="hidden text-[0.9375rem] font-semibold hover:underline sm:block"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className="hidden text-[0.9375rem] font-semibold hover:underline sm:block"
          >
            Pricing
          </Link>
          <ButtonLink
            href={signedIn ? "/dashboard" : "/login"}
            size="sm"
            variant="primary"
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
    <footer className="border-t-2 border-pepper bg-pepper text-butter">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-[1.3fr_1fr_1fr]">
        <div>
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

      <div className="border-t border-butter/15">
        <p className="mx-auto max-w-6xl px-5 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-butter/55">
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
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link
              href={href}
              className="text-[0.9375rem] text-butter/80 hover:text-butter hover:underline"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
