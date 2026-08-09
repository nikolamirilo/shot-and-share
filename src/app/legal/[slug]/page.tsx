import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Eyebrow } from "@/components/ui";
import { HARD_DELETE_GRACE_DAYS, TIERS } from "@/lib/tiers";

/**
 * Placeholder legal copy.
 *
 * It states what the product actually does with data, which is the part that
 * has to be true, but it is not a lawyer's document and must be reviewed before
 * launch - particularly the GDPR sections, since photos of identifiable people
 * are personal data and the host is the controller.
 */
const PAGES: Record<
  string,
  { title: string; intro: string; sections: Array<[string, string]> }
> = {
  terms: {
    title: "Terms",
    intro:
      "Plain description of what we do and what we expect. This is placeholder copy pending legal review.",
    sections: [
      [
        "What the service is",
        "Say Cheese gives the host of an event a link and a QR code. Guests use it to upload photos and video. The host can view, delete and download everything collected.",
      ],
      [
        "What you pay for",
        `Plans are a one-time payment per event: ${TIERS.event.name} at €${TIERS.event.priceEur} and ${TIERS.wedding.name} at €${TIERS.wedding.priceEur}. There is no subscription. The Cellar add-on is €29 paid once and keeps the photos permanently.`,
      ],
      [
        "How long we keep things",
        `Each plan states a storage window. We email warnings 14, 7 and 1 days before it ends. When it ends the event is paused rather than deleted and stays restorable for ${HARD_DELETE_GRACE_DAYS} days. Only after that is anything actually removed.`,
      ],
      [
        "What you must not upload",
        "Anything illegal, anything you do not have the right to share, and anything designed to harm the service. Hosts can delete content and revoke a link at any time, and we will remove illegal content on report.",
      ],
      [
        "Refunds",
        "If the service does not work for your event, write to us and we will refund you. We would rather do that than argue about it.",
      ],
    ],
  },
  privacy: {
    title: "Privacy",
    intro:
      "What we hold, why, and for how long. This is placeholder copy pending legal review.",
    sections: [
      [
        "What we store about hosts",
        "Your name, email address and profile picture from Google sign-in, plus the events you create. That is all the account holds.",
      ],
      [
        "What we store about guests",
        "No account, no email address, no name unless a guest types one in. A random identifier is kept in the guest's own browser so they can remove a photo they just uploaded; it is not linked to any person.",
      ],
      [
        "The photos themselves",
        "Stored in encrypted object storage in the EU. Thumbnails are served through a CDN using unguessable addresses; full-resolution originals are only ever served through short-lived signed links. We do not look at your photos and we do not use them to train anything.",
      ],
      [
        "Who is the controller",
        "For photos collected at an event, the host is the data controller and we are the processor acting on their instructions. Guests who want a photo removed should ask the host, and the host can always delete it.",
      ],
      [
        "Deletion",
        `When a storage window ends, or when a host deletes an event, the files are removed from storage. Host-initiated deletion is immediate. Automatic expiry runs through warnings and a ${HARD_DELETE_GRACE_DAYS}-day pause first.`,
      ],
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: PAGES[slug]?.title ?? "Legal" };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();

  return (
    <>
      <SiteHeader />
      <main className="bg-butter">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-5 sm:py-16">
          <Eyebrow>Legal</Eyebrow>
          <h1 className="mt-3 text-[2.25rem] sm:text-h1">{page.title}</h1>
          <p className="mt-4 text-body text-crust">{page.intro}</p>

          <div className="mt-8 space-y-7 sm:mt-10 sm:space-y-8">
            {page.sections.map(([heading, body]) => (
              <section key={heading}>
                <h2 className="text-h3">{heading}</h2>
                <p className="mt-2 leading-relaxed text-crust">{body}</p>
              </section>
            ))}
          </div>

          <p className="mt-12 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
            Placeholder - review before launch
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
