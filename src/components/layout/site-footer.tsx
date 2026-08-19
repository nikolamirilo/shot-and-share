import Link from "next/link";

import { Wordmark } from "@/components/layout/logo";
import { OPERATOR, addressLine } from "@/lib/legal/operator";
import { LEGAL_ORDER, LEGAL_PAGES } from "@/lib/legal/pages";
import { SITE } from "@/lib/seo";

/**
 * The footer is where a payment reviewer spends about four seconds, and what
 * they are looking for is whether a real entity is trading here. So the
 * operator, its registration numbers and all four legal documents are on every
 * page, not tucked behind a link to a "company" section.
 */
export function SiteFooter() {
  return (
    <footer className="bg-ink text-linen">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-9 px-4 py-12 sm:grid-cols-[1.3fr_1fr_1fr] sm:gap-10 sm:px-5 sm:py-14">
        {/* Two columns of links side by side on a phone rather than three
            stacked blocks: it halves the scroll and the columns are short. */}
        <div className="col-span-2 sm:col-span-1">
          <Wordmark variant="reversed" markClassName="h-7 w-auto sm:h-8" />
          <p className="mt-3 max-w-xs text-[0.9375rem] text-linen/75">
            {SITE.tagline}
          </p>
          <a
            href={`mailto:${SITE.email}`}
            className="mt-3 inline-block py-1 text-[0.9375rem] text-linen/80 underline underline-offset-2 hover:text-linen"
          >
            {SITE.email}
          </a>
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
          title="Legal"
          links={LEGAL_ORDER.map((slug) => [
            LEGAL_PAGES[slug].navLabel,
            `/${slug}`,
          ])}
        />
      </div>

      {/* A shadow falls on nothing at this end of the page, so the colophon is
          divided off by sinking a shade rather than by a rule. */}
      <div className="bg-black/15">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-5">
          <p className="text-[0.8125rem] leading-relaxed text-linen/70">
            Shot &amp; Share is a product of {OPERATOR.legalName},{" "}
            {OPERATOR.form}.
            <br className="hidden sm:block" />{" "}
            <span className="text-linen/55">
              {addressLine()} · Registration number{" "}
              {OPERATOR.registrationNumber} · Tax number {OPERATOR.taxNumber}
            </span>
          </p>
          <p className="mt-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-linen/55">
            © {new Date().getFullYear()} {SITE.name}
          </p>
        </div>
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
