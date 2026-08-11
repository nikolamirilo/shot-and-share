import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { Eyebrow } from "@/components/ui";
import { breadcrumbSchema, graph } from "@/lib/seo";
import { HARD_DELETE_GRACE_DAYS, TIERS } from "@/lib/tiers";

/**
 * The terms and the privacy policy.
 *
 * Two rules were followed writing these. Everything stated about the system is
 * true of the code in this repository - the retention windows come from the
 * same constants the product enforces, and the list of companies that touch the
 * data is the list of services this app actually calls. And everything that
 * cannot be known from the code, which is the operating company and the law it
 * answers to, is left as a marked blank rather than guessed at.
 *
 * They are still not a lawyer's documents. The GDPR sections in particular
 * matter more here than in most products: photographs of identifiable people
 * are personal data, the host is the controller of them, and the split of
 * responsibility between the host and us is the part worth paying someone to
 * check.
 */

const UPDATED = "11 August 2026";

/** Filled in before launch. Marked so it cannot be shipped by accident. */
const OPERATOR = "[operating company, registered address and company number]";
const JURISDICTION = "[country of the operating company]";

interface Section {
  heading: string;
  body: string[];
  list?: string[];
}

interface LegalPage {
  title: string;
  intro: string;
  sections: Section[];
}

const TERMS: LegalPage = {
  title: "Terms & Conditions",
  intro:
    "What Shot & Share does, what you pay, and what each of us is responsible for. Written to be read rather than to be survived.",
  sections: [
    {
      heading: "Who we are",
      body: [
        `Shot & Share is operated by ${OPERATOR}. You can reach a person at hello@shotandshare.co, and we answer.`,
        "These terms are between you - the person creating an event, who we call the host - and us. By creating an event you accept them.",
      ],
    },
    {
      heading: "What the service is",
      body: [
        "You create an event and get a link and a printable QR code. Your guests use it to upload photos and video from their phones. You can view, delete and download everything they send.",
        "Guests do not need an account, an app, or to give us their name. That is the point of the product, and it is also why the responsibility for what ends up in your gallery sits mostly with you.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "You sign in with Google. You are responsible for keeping access to that account, and anyone who can open it can open your events.",
        "You must be old enough to enter a contract where you live. If you are creating an event on behalf of a company or a couple, you confirm you are allowed to agree to this on their behalf.",
      ],
    },
    {
      heading: "Plans and payment",
      body: [
        `Plans are a one-time payment per event, not a subscription. ${TIERS.event.name} is €${TIERS.event.priceEur} and ${TIERS.wedding.name} is €${TIERS.wedding.priceEur}. The Archive add-on is €29, also paid once, and keeps that event's photos permanently.`,
        "There is nothing to cancel and nothing that renews. Payment is handled by Lemon Squeezy, who act as merchant of record - your card details never reach us, and your receipt comes from them.",
        "Prices include VAT where it applies. Upgrading an event mid-way charges the difference rather than the full price again.",
      ],
    },
    {
      heading: "Refunds",
      body: [
        "If the service does not work for your event, write to us and we will refund you. We would rather do that than argue about it.",
        "That is deliberately broader than the law requires, and it is not conditional on your having used the product a certain way.",
      ],
    },
    {
      heading: "How long we keep your event",
      body: [
        `Every plan states a storage window. We email you 14 days, 7 days and 1 day before it ends. When it ends the event is paused rather than deleted: nothing is removed, guests see a closed page, and you can restore it for ${HARD_DELETE_GRACE_DAYS} days.`,
        "Only after that grace period does anything actually get erased, and erasure is permanent. If you want to avoid the question entirely, the Archive add-on keeps the event indefinitely.",
      ],
    },
    {
      heading: "What may not be uploaded",
      body: [
        "You and your guests must not upload:",
      ],
      list: [
        "anything illegal, or anything depicting the abuse or exploitation of anyone",
        "anything you do not have the right to share, including someone else's photographs",
        "images of people who have told you they do not want to be photographed",
        "anything intended to damage the service or the people using it",
      ],
    },
    {
      heading: "Your photos stay yours",
      body: [
        "You and your guests keep every right in the photographs. We do not claim ownership of them, we do not use them to advertise the product, and we do not use them to train machine-learning models.",
        "You give us only the permission we need to run the service: to store the files, to make the thumbnails and previews the gallery displays, to package them into a ZIP when you ask, and to serve them to whoever holds your link. That permission ends when the files are deleted.",
      ],
    },
    {
      heading: "You are responsible for your guests",
      body: [
        "Your link is the door to your event, and anyone who has it can upload. If it reaches somewhere it should not have, you can revoke it from the dashboard and it stops working immediately.",
        "Because the guests are yours and the event is yours, you are responsible for telling them what is being collected and for handling anyone who asks for a photo to be removed. You can delete any individual photo at any time.",
      ],
    },
    {
      heading: "What we do not promise",
      body: [
        "We work hard to keep the service up, particularly on a Saturday evening, but we do not promise it will never be unavailable. We do not promise a photograph can never be lost, which is why you should download the ZIP rather than treat us as your only copy.",
        "We may change how features work. If a change removes something you paid for, tell us and we will refund you.",
      ],
    },
    {
      heading: "Suspending or ending an event",
      body: [
        "We can suspend or remove an event that breaks the rules above, or that we are legally required to act on. Where we can, we will tell you first and give you a chance to download what is there.",
        "You can delete your event and everything in it at any time, from Settings. That deletion is immediate and cannot be undone.",
      ],
    },
    {
      heading: "Liability",
      body: [
        "Nothing here limits liability for death, personal injury, or fraud, and nothing here takes away rights you have as a consumer that cannot be signed away.",
        "Beyond that, and to the extent the law allows, what we owe you for any problem is capped at what you paid us for that event. We are not liable for indirect losses - a missed opportunity, a lost contract, or the cost of having a photographer reshoot something.",
      ],
    },
    {
      heading: "Changes to these terms",
      body: [
        "If we change them in a way that matters, we will email the address on your account before the change takes effect. Events already paid for keep the terms they were bought under.",
      ],
    },
    {
      heading: "Law and disputes",
      body: [
        `These terms are governed by the law of ${JURISDICTION}, and its courts have jurisdiction. If you are a consumer in the EU or the UK, you keep the protection of the mandatory law of the country you live in and can bring a claim there.`,
        "Before any of that, please just write to us. Almost everything is fixable by email.",
      ],
    },
  ],
};

const PRIVACY: LegalPage = {
  title: "Privacy Policy",
  intro:
    "What we hold, why we are allowed to hold it, who else touches it, and how long it stays. Photographs of people are personal data, so this matters more here than it does for most products.",
  sections: [
    {
      heading: "Who is responsible for what",
      body: [
        `For your host account - your email address, your events, your payments - ${OPERATOR} is the data controller and this policy explains what we do with it.`,
        "For the photographs your guests upload, you are the controller and we are your processor. They are collected for your event, on your instructions, and we act on them rather than deciding anything about them ourselves. In practice that means a guest asking for a photo to be taken down should ask you, and you can remove it in a click.",
      ],
    },
    {
      heading: "What we hold about hosts",
      body: [
        "The name, email address and profile picture that Google gives us when you sign in, the events you create and their settings, and a record of what you paid for. That is the whole account.",
        "We do not ask for a postal address, a phone number, or a date of birth, because we do not need them.",
      ],
    },
    {
      heading: "What we hold about guests",
      body: [
        "No account, no email address, and no name unless a guest chooses to type one when uploading.",
        "A random identifier is stored in the guest's own browser so that they can delete a photo they have just uploaded and so that we can count how many separate people contributed. It is not linked to a person, it does not follow them to any other site, and clearing their browser data removes it.",
        "We count how many times a link has been opened. That is a number, not a log of who opened it.",
      ],
    },
    {
      heading: "The photos and videos",
      body: [
        "They are stored in object storage in the EU. Thumbnails are served from unguessable addresses; full-resolution originals are only ever served through short-lived signed links that expire.",
        "We do not look at your photographs, we do not use them to advertise the product, and we do not use them to train machine-learning models. No human at our end opens an event's gallery unless you ask us to help with a specific problem.",
        "Photographs usually carry embedded camera data, which can include the location where the picture was taken. We do not read it, and it travels with the file into your ZIP exactly as the camera wrote it.",
      ],
    },
    {
      heading: "Why we are allowed to hold it",
      body: [
        "For host accounts and payments: because we need it to give you the service you asked for, and because tax law requires us to keep records of what was sold.",
        "For the photographs: on your instructions as the controller. The lawful basis for collecting them from your guests is yours to have, and in practice it is the guest's own choice to upload.",
        "For the small number of counts we keep - photos, uploaders, link opens - because we have a legitimate interest in knowing whether the product works, and because they are counts rather than profiles.",
      ],
    },
    {
      heading: "Cookies",
      body: [
        "One cookie keeps you signed in. There is no advertising cookie, no analytics cookie, and no third-party tracker on any page of this site.",
        "The identifier stored in a guest's browser is not a cookie and is not sent to anyone else.",
      ],
    },
    {
      heading: "Who else touches the data",
      body: [
        "As few companies as we can manage. Each one does a specific job and none of them may use anything for their own purposes:",
      ],
      list: [
        "Supabase - accounts and the database that holds your events",
        "Our object storage provider - the photograph and video files themselves, in the EU",
        "Vercel - running and serving the website",
        "Lemon Squeezy - payment, as merchant of record; they hold your payment details, we never see them",
        "Resend - sending the emails this product sends, such as the warnings before a storage window ends",
        "Google - only if you sign in with it, and only the account you chose",
      ],
    },
    {
      heading: "Where it is",
      body: [
        "Files are stored in the EU. Some of the companies above are based in the United States and may process data there; where they do, the transfer runs on the European Commission's standard contractual clauses.",
      ],
    },
    {
      heading: "How long it stays",
      body: [
        `Photographs live as long as the event's storage window, then through the ${HARD_DELETE_GRACE_DAYS}-day paused period, then they are erased. With the Archive add-on they stay until you delete them.`,
        "Deleting an event deletes its files immediately. Your account stays until you ask us to close it, at which point it and everything in it goes, except the payment records tax law requires us to keep.",
      ],
    },
    {
      heading: "How it is protected",
      body: [
        "Files are encrypted at rest and everything travels over HTTPS. Share links use long random tokens rather than guessable ids, and a revoked link stops working at once.",
        "Access to production data is limited to the people who need it to run the service.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "If you are in the EU or the UK you can ask us for a copy of what we hold about you, ask us to correct it, ask us to delete it, ask us to restrict or stop a particular use, and ask for it in a portable form. Write to hello@shotandshare.co and we will answer within a month.",
        "Most of it you can do yourself and faster: your gallery is your export, and deleting an event deletes its contents.",
      ],
    },
    {
      heading: "If you are a guest",
      body: [
        "Ask the host who gave you the link - they control the event and can delete any photo immediately. If you cannot reach them, write to us and we will help.",
      ],
    },
    {
      heading: "Children",
      body: [
        "The service is not directed at children and we do not knowingly collect data from them. Children appear in event photographs, of course; those photographs are the host's responsibility, and a parent who wants one removed should ask the host or us.",
      ],
    },
    {
      heading: "Complaints",
      body: [
        `If we have got something wrong, tell us first. You also have the right to complain to the data protection authority where you live, or to the one in ${JURISDICTION}.`,
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "If we change it in a way that matters, we will email the address on your account. The date at the top of this page always says when it last changed.",
      ],
    },
  ],
};

const PAGES: Record<string, LegalPage> = {
  terms: TERMS,
  privacy: PRIVACY,
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
  const page = PAGES[slug];
  if (!page) return { title: "Legal", robots: { index: false, follow: true } };

  return {
    title: page.title,
    /* The intro sentence is the description. Legal pages are the one place
       where a hand-written summary would say something different from the page
       itself, and the page is the part that has to be true. */
    description: page.intro,
    alternates: { canonical: `/legal/${slug}` },
  };
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
      <JsonLd
        id="ld-legal"
        json={graph(
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: page.title, path: `/legal/${slug}` },
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
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
