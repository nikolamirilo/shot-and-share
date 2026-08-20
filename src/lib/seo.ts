import { KEEP_FOREVER, TIERS, TIER_ORDER } from "@/lib/tiers";
import { env } from "@/lib/env";
import { FAQS } from "@/lib/faqs";

/**
 * One place that knows how this site describes itself.
 *
 * Anything a crawler reads that also appears on screen is derived from the same
 * constant the screen reads, because the failure mode of SEO work is drift: a
 * price changes in `tiers.ts` and the JSON-LD keeps advertising the old one.
 */

export const SITE = {
  name: "Shot & Share",
  /** Used where a bare word reads better than the full lockup. */
  shortName: "Shot & Share",
  tagline: "Every photo your guests take.",
  description:
    "Guests scan a code and hand you their photos. No app, no account, nothing to install. Weddings, birthdays, offsites - anything with people and phones.",
  locale: "en",
  /**
   * Where support, legal notices, takedowns and erasure requests all go.
   *
   * One address on purpose. Four published addresses that all forward to the
   * same inbox look like a bigger company and behave like a worse one: the
   * legal pages promise a reply within a stated time, and a promise is only
   * kept by an address somebody actually reads.
   */
  email: "support@shotandshare.com",
} as const;

/**
 * The promise the landing page opens with, in the words it uses.
 *
 * Here rather than inline in the hero because the social card has to say the
 * same thing: a card promising one headline and a page opening with another is
 * exactly the drift this file exists to stop. The hero sets the headline over
 * two lines, so it is kept as its lines and joined for anywhere that wants one
 * string - the card, an alt attribute.
 *
 * Distinct from `SITE.tagline`, which is what the product calls itself in a
 * browser tab and in structured data. This is what the page says out loud, and
 * the two are allowed to differ.
 */
export const HERO = {
  kicker: "Final touch to event organization",
  headlineLines: ["Let your guests", "capture the moments you miss"],
  subline: "One code on the table. No app, no account.",
} as const;

/** The headline as one line, for a card or an alt attribute. */
export function heroHeadline(): string {
  return HERO.headlineLines.join(" ");
}

/**
 * Never hard-coded: a canonical tag pointing at production from a preview
 * deployment is how a staging site ends up in the index.
 */
export function siteUrl(): string {
  return env.siteUrl.replace(/\/$/, "");
}

/** An absolute URL for a path, which is what structured data requires. */
export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The public pages. The sitemap and the breadcrumbs both read this, so a page
 * cannot be added to one and forgotten in the other.
 */
export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/demo", changeFrequency: "monthly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/acceptable-use", changeFrequency: "yearly", priority: 0.3 },
] as const;

/**
 * Blocked from crawling, which is not the same as noindex. A path that must
 * never be *indexed* has to stay crawlable so the directive is read - that is
 * `/e/` and `/login`. These are merely private, so nobody's crawl budget goes
 * on them.
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
 * The product, priced from `tiers.ts`. `SoftwareApplication` carries an offer
 * list without pretending there is a thing being shipped.
 */
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
 * Built from the same array the page renders, so the markup can never promise
 * an answer a visitor cannot find - which is what earns a manual action.
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
 * One document per page with the nodes cross-referenced by `@id`, so a crawler
 * reads the application, the FAQ and the publisher as one site.
 */
export function graph(...nodes: Json[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": nodes,
  });
}
