import Link from "next/link";

import { Wordmark } from "@/components/layout/logo";

export function SiteFooter() {
  return (
    <footer className="bg-ink text-linen">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-9 px-4 py-12 sm:grid-cols-[1.3fr_1fr_1fr] sm:gap-10 sm:px-5 sm:py-14">
        {/* Two columns of links side by side on a phone rather than three
            stacked blocks: it halves the scroll and the columns are short. */}
        <div className="col-span-2 sm:col-span-1">
          <Wordmark variant="reversed" markClassName="h-7 w-auto sm:h-8" />
          <p className="mt-3 max-w-xs text-[0.9375rem] text-linen/75">
            Every photo your guests take.
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
            ["Contact", "mailto:hello@shotandshare.co"],
          ]}
        />
      </div>

      {/* A shadow falls on nothing at this end of the page, so the colophon is
          divided off by sinking a shade rather than by a rule. */}
      <div className="bg-black/15">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-linen/55 sm:px-5">
          © {new Date().getFullYear()} Shot & Share
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
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-rose-soft">
        {title}
      </p>
      <ul className="mt-3 space-y-1">
        {links.map(([label, href]) => (
          <li key={label}>
            {/* Inline-block with vertical padding rather than a bare link:
                a footer link on a phone is a thumb target, not a word. */}
            <Link
              href={href}
              className="inline-block py-1 text-[0.9375rem] text-linen/80 hover:text-linen hover:underline"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
