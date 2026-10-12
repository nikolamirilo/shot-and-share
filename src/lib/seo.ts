import { KEEPING, KEEPING_NAME, TIERS, TIER_ORDER } from "@/lib/tiers";
import { env } from "@/lib/env";
import { FAQS } from "@/lib/faqs";

export const SITE = {
  name: "Shot & Share",
  shortName: "Shot & Share",
  tagline: "Every photo your guests take.",
  description:
    "Guests scan a code and hand you their photos. No app, no account, nothing to install. Weddings, birthdays, offsites - anything with people and phones.",
  about:
    "Shot & Share is a QR photo-sharing app for weddings, birthdays and other events. Guests scan a printed code and upload photos from their own phones, with no app and no account.",
  locale: "en",
  email: "support@shotandshare.com",
} as const;

export const HERO = {
  kicker: "QR photo sharing for weddings & events",
  headlineLines: ["Collect", "every photo", "your guests take."],
  subline:
    "Guests scan one code on the table and add photos from their own phone. You get the whole night in one gallery, and all of it in one download.",
  cardLine: "One code on the table. No app, no account.",
  purpose:
    "Shot & Share is a web app for collecting photos from guests at a wedding, a birthday or any other event. You print a QR code, guests scan it and upload from their own phones, and every photo lands in one gallery you can download.",
} as const;

export function heroHeadline(): string {
  return HERO.headlineLines.join(" ");
}

export function siteUrl(): string {
  return env.siteUrl.replace(/\/$/, "");
}

export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/demo", changeFrequency: "monthly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/acceptable-use", changeFrequency: "yearly", priority: 0.3 },
] as const;

export const DISALLOWED_PATHS = [
  "/api/",
  "/auth/",
  "/dashboard/",
  "/account/",
] as const;

export const EVENT_LINK = {
  invitation: "Add your photos",
  invitationBranded: "Add your photos - no app, no account",
} as const;

export function eventLinkTitle(name: string): string {
  return `${name}`;
}

export function eventLinkDescription(
  name: string,
  message?: string | null,
): string {
  const written = message?.trim();
  if (written) return clip(written, 200);

  return `Add the photos you took at ${name}. Open the link, pick your photos, and they go straight to the host - no app and no account.`;
}

function clip(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

type Json = Record<string, unknown>;

const ORGANISATION_ID = () => `${siteUrl()}/#organisation`;
const WEBSITE_ID = () => `${siteUrl()}/#website`;

export function organisationSchema(): Json {
  return {
    "@type": "Organization",
    "@id": ORGANISATION_ID(),
    name: SITE.name,
    url: siteUrl(),
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/logo.svg"),
      width: 200,
      height: 200,
    },
    email: SITE.email,
    description: SITE.description,
  };
}

export function websiteSchema(): Json {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID(),
    name: SITE.name,
    url: siteUrl(),
    description: SITE.description,
    inLanguage: SITE.locale,
    publisher: { "@id": ORGANISATION_ID() },
  };
}

export function softwareApplicationSchema(): Json {
  const offers = TIER_ORDER.map((key) => {
    const tier = TIERS[key];
    return {
      "@type": "Offer",
      name: tier.name,
      description: tier.meaning,
      price: tier.priceEur,
      priceCurrency: "EUR",
      url: absoluteUrl("/pricing"),
      availability: "https://schema.org/InStock",
    };
  }).concat({
    "@type": "Offer",
    name: KEEPING_NAME,
    description:
      "Keep an event's photos online past the window the plan includes. Billed yearly, cancel any time.",
    price: KEEPING.plus.priceEur,
    priceCurrency: "EUR",
    url: absoluteUrl("/pricing"),
    availability: "https://schema.org/InStock",
  });

  return {
    "@type": "SoftwareApplication",
    "@id": `${siteUrl()}/#application`,
    name: SITE.name,
    url: siteUrl(),
    description: SITE.description,
    applicationCategory: "MultimediaApplication",
    applicationSubCategory: "Event photo sharing",
    operatingSystem: "Any modern web browser",
    browserRequirements: "Requires JavaScript.",
    publisher: { "@id": ORGANISATION_ID() },
    offers,
    featureList: [
      "QR code and link for guests, printable before payment",
      "No guest account and no app to install",
      "Shared gallery every guest can see",
      "Bulk ZIP download of the whole event",
      "Live slideshow at the venue",
      "Custom event page: theme, type, cover and layout",
    ],
  };
}

export function faqSchema(): Json {
  return {
    "@type": "FAQPage",
    "@id": `${siteUrl()}/#faq`,
    mainEntity: FAQS.map(({ question, short, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: `${short} ${answer}` },
    })),
  };
}

export function breadcrumbSchema(
  trail: Array<{ name: string; path: string }>,
): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}

export function graph(...nodes: Json[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": nodes,
  });
}
