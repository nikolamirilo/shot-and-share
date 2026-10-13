import Link from "next/link";

import { Wordmark } from "@/components/layout/Logo";
import { OPERATOR, addressLine } from "@/lib/legal/operator";
import { LEGAL_ORDER, LEGAL_PAGES } from "@/lib/legal/pages";
import { SITE } from "@/lib/seo";

export function SiteFooter() {
  return (
    <footer className="bg-ink text-linen">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-9 px-4 py-12 sm:grid-cols-[1.3fr_1fr_1fr] sm:gap-10 sm:px-5 sm:py-14">
        <div className="col-span-2 sm:col-span-1">
          <Wordmark variant="reversed" markClassName="h-7 w-auto sm:h-8" />
          <p className="mt-3 max-w-xs text-[0.9375rem] text-linen/75">
            {SITE.tagline}
          </p>
          <p className="mt-2 max-w-xs text-[0.8125rem] leading-relaxed text-linen/60">
            {SITE.about}
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
