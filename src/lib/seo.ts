import { KEEP_FOREVER, TIERS, TIER_ORDER } from "@/lib/tiers";
import { env } from "@/lib/env";
import { FAQS } from "@/lib/faqs";

/**
 * One place that knows how this site describes itself.
 *
 * Every title, description, canonical and piece of structured data is built
 * from here rather than typed at each page, because the failure mode of SEO
 * work is drift: a price changes in `tiers.ts`, the JSON-LD keeps advertising
 * the old one, and a search engine has been told something the page does not
 * say. Anything a crawler reads that also appears on screen is derived from the
 * same constant the screen reads.
 */

export const SITE = {
  name: "Shot & Share",
  /** Used where a bare word reads better than the full lockup. */
  shortName: "Shot & Share",
  tagline: "Every photo your guests take.",
  description:
    "Guests scan a code and hand you their photos. No app, no account, nothing to install. Weddings, birthdays, offsites - anything with people and phones.",
  locale: "en",
  /** Where support and legal notices actually go. */
  email: "hello@shotandshare.co",
} as const;

/**
 * The origin, from the environment.
 *
 * Never hard-coded: a canonical tag pointing at production from a preview
 * deployment is how a staging site ends up in the index, and how the real one
 * ends up de-duplicated against it.
 */
export function siteUrl(): string {
  return env.siteUrl.replace(/\/$/, "");
}

/** An absolute URL for a path, which is what structured data requires. */
export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The public pages, in the order a person would meet them.
 *
 * The sitemap and the breadcrumbs both read this, so a page cannot be added to
 * one and forgotten in the other.
 */
export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/legal/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.3 },
] as const;

/**
 * Everything a crawler is asked to stay out of.
 *
 * Two different tools for two different jobs, and mixing them up is the classic
 * mistake. A path that must never be *indexed* has to stay crawlable so the
 * noindex directive is actually read - that is `/e/` and `/login`, which carry
 * it in a header and in their metadata. A path that is merely private and
 * behind a redirect is blocked here instead, to spend nobody's crawl budget on
 * it.
 */
export const DISALLOWED_PATHS = [
  "/api/",
  "/auth/",
  "/dashboard/",
  "/account/",
] as const;

/* -------------------------------------------------------------------------- */
/*  Structured data                                                            */
/* -------------------------------------------------------------------------- */

type Json = Record<string, unknown>;

const ORGANISATION_ID = () => `${siteUrl()}/#organisation`;
const WEBSITE_ID = () => `${siteUrl()}/#website`;

/** Who publishes this. Referenced by @id from everything else. */
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

/**
 * The product, priced from `tiers.ts`.
 *
 * `SoftwareApplication` rather than `Product` because that is what this is, and
 * because it carries an offer list without pretending there is a thing being
 * shipped. The free tier is included: "there is a free plan" is the single most
 * useful fact in a result page for this category.
 */
export function softwareApplicationSchema(): Json {
  const offers = TIER_ORDER.map((id) => {
    const tier = TIERS[id];
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
    name: KEEP_FOREVER.name,
    description: KEEP_FOREVER.meaning,
    price: KEEP_FOREVER.priceEur,
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

/**
 * The questions on the landing page, and only those.
 *
 * Built from the same array the page renders, so the markup can never promise
 * an answer a visitor cannot find - which is the one thing that turns FAQ
 * structured data from useful into a manual action.
 */
export function faqSchema(): Json {
  return {
    "@type": "FAQPage",
    "@id": `${siteUrl()}/#faq`,
    mainEntity: FAQS.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
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

/**
 * A `@graph` rather than a page full of separate script tags.
 *
 * One document per page, with the nodes cross-referenced by `@id`, is what lets
 * a crawler understand that the application, the FAQ and the publisher are the
 * same site rather than three unrelated claims.
 */
export function graph(...nodes: Json[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": nodes,
  });
}
