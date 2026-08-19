import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { Eyebrow } from "@/components/ui";
import { OPERATOR, addressLine } from "@/lib/legal/operator";
import { LEGAL_PAGES, type LegalSlug, UPDATED } from "@/lib/legal/pages";
import { breadcrumbSchema, graph } from "@/lib/seo";

/**
 * One layout for all four documents.
 *
 * They used to be a `[slug]` route under `/legal`. They are four real paths now
 * because those are the paths a payment reviewer types, and a document that
 * cannot be found is the same as one that was never written.
 */

export function legalMetadata(slug: LegalSlug): Metadata {
  const page = LEGAL_PAGES[slug];
  return {
    title: page.title,
    /* The intro sentence is the description. Legal pages are the one place
       where a hand-written summary would say something different from the page
       itself, and the page is the part that has to be true. */
    description: page.intro,
    alternates: { canonical: `/${slug}` },
  };
}

export function LegalDocument({ slug }: { slug: LegalSlug }) {
  const page = LEGAL_PAGES[slug];

  return (
    <>
      <JsonLd
        id={`ld-legal-${slug}`}
        json={graph(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: page.title, path: `/${slug}` },
          ]),
        )}
      />

      <SiteHeader />
      <main className="bg-linen">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-5 sm:py-16">
          <Eyebrow>Legal</Eyebrow>
          <h1 className="mt-3 text-[2.25rem] leading-[1.05] sm:text-h1">
            {page.title}
          </h1>
          <p className="mt-4 text-body text-ash">{page.intro}</p>
          <p className="mt-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            Last updated {UPDATED}
          </p>

          {/* Numbered, because a legal document is referred to by its section
              rather than read start to finish. */}
          <ol className="mt-10 space-y-8 sm:mt-12 sm:space-y-9">
            {page.sections.map((section, index) => (
              <li key={section.heading}>
                <h2 className="flex gap-3 text-h3">
                  <span className="shrink-0 font-mono text-[0.8125rem] leading-[1.9] tracking-[0.1em] text-mist tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.heading}
                </h2>

                <div className="mt-2 space-y-3 pl-[2.1rem]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="leading-relaxed text-ash">
                      {paragraph}
                    </p>
                  ))}

                  {section.list && (
                    <ul className="space-y-2">
                      {section.list.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2.5 leading-relaxed text-ash"
                        >
                          <span
                            aria-hidden
                            className="mt-[0.7em] size-[0.4rem] shrink-0 rounded-full bg-rose-soft"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* The entity again, at the end of every document. A reviewer who
              opened one page directly should not have to find another to learn
              who is trading. */}
          <div className="mt-12 border-t border-ink/10 pt-6 sm:mt-14">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
              Operator
            </p>
            <p className="mt-2 leading-relaxed text-ash">
              {OPERATOR.legalName}, {OPERATOR.form}.
              <br />
              {addressLine()}
              <br />
              Registration number {OPERATOR.registrationNumber}, tax number{" "}
              {OPERATOR.taxNumber}.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
