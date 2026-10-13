import type { Metadata } from "next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { Eyebrow } from "@/components/ui";
import { OPERATOR, addressLine } from "@/lib/legal/operator";
import { LEGAL_PAGES, type LegalSlug, UPDATED } from "@/lib/legal/pages";
import { breadcrumbSchema, graph } from "@/lib/seo";
import { getHeaderUser } from "@/lib/supabase/server";

export function legalMetadata(slug: LegalSlug): Metadata {
  const page = LEGAL_PAGES[slug];
  return {
    title: page.title,
    description: page.intro,
    alternates: { canonical: `/${slug}` },
  };
}

export async function LegalDocument({ slug }: { slug: LegalSlug }) {
  const page = LEGAL_PAGES[slug];
  const user = await getHeaderUser();

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

      <SiteHeader user={user} />
      <main className="bg-linen">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16">
          <Eyebrow>Legal</Eyebrow>
          <h1 className="mt-3 text-[2.25rem] leading-[1.05] sm:text-h1">
            {page.title}
          </h1>
          <p className="mt-4 text-body text-ash">{page.intro}</p>
          <p className="mt-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
            Last updated {UPDATED}
          </p>

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
