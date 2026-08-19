import { describe, expect, it } from "vitest";

import { LEGAL_ORDER, LEGAL_PAGES } from "@/lib/legal/pages";
import { OPERATOR, OPERATOR_LINE, addressLine } from "@/lib/legal/operator";
import { PUBLIC_ROUTES } from "@/lib/seo";
import { HARD_DELETE_GRACE_DAYS, TIERS } from "@/lib/tiers";

/**
 * The four documents a merchant of record looks for.
 *
 * These assertions are not about prose. They are about the handful of facts a
 * reviewer scans for in about four seconds, every one of which has been shipped
 * missing by somebody at some point: the trading entity, the registration
 * numbers, an address to write to, and a refund window stated as a number.
 */

const text = (slug: keyof typeof LEGAL_PAGES) => {
  const page = LEGAL_PAGES[slug];
  return [
    page.intro,
    ...page.sections.flatMap((section) => [
      section.heading,
      ...section.body,
      ...(section.list ?? []),
    ]),
  ].join("\n");
};

const everything = LEGAL_ORDER.map(text).join("\n");

describe("the pages exist and are reachable", () => {
  it("has all four", () => {
    expect(LEGAL_ORDER).toEqual([
      "terms",
      "privacy",
      "refund-policy",
      "acceptable-use",
    ]);
  });

  it("lists every one in the sitemap", () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);
    for (const slug of LEGAL_ORDER) {
      expect(paths).toContain(`/${slug}`);
    }
  });

  it("gives each one a title and a footer label", () => {
    for (const slug of LEGAL_ORDER) {
      expect(LEGAL_PAGES[slug].title.length).toBeGreaterThan(0);
      expect(LEGAL_PAGES[slug].navLabel.length).toBeGreaterThan(0);
      expect(LEGAL_PAGES[slug].sections.length).toBeGreaterThan(0);
    }
  });
});

describe("the operator is named, not implied", () => {
  /*
   * The failure this file exists to prevent. These pages shipped for months
   * with "[operating company, registered address and company number]" in them,
   * which reads to a reviewer as a store that has not been set up.
   */
  it("has no placeholders left anywhere", () => {
    expect(everything).not.toMatch(/\[[a-z][^\]]*\]/i);
    expect(everything.toUpperCase()).not.toContain("REPLACE_ME");
    expect(everything.toUpperCase()).not.toContain("TODO");
  });

  it("names the trading entity on the terms", () => {
    expect(text("terms")).toContain(OPERATOR.legalName);
  });

  it("gives both registration numbers on the terms", () => {
    expect(text("terms")).toContain(OPERATOR.registrationNumber);
    expect(text("terms")).toContain(OPERATOR.taxNumber);
  });

  it("gives a postal address on the terms and the acceptable use policy", () => {
    expect(text("terms")).toContain(addressLine());
    expect(text("acceptable-use")).toContain(OPERATOR.legalName);
  });

  it("names the controller on the privacy policy", () => {
    // Not the same requirement as the terms: a data protection authority looks
    // for a controller, not a seller, and they have to be the same entity here.
    expect(text("privacy")).toContain(OPERATOR.legalName);
    expect(text("privacy")).toContain(OPERATOR.registrationNumber);
  });

  it("joins the product to the entity in one sentence", () => {
    expect(OPERATOR_LINE).toContain("Shot & Share");
    expect(OPERATOR_LINE).toContain(OPERATOR.legalName);
  });
});

describe("the answers a reviewer is actually looking for", () => {
  it("gives an email address on every page", () => {
    for (const slug of LEGAL_ORDER) {
      expect(text(slug)).toMatch(/[\w.]+@[\w.]+/);
    }
  });

  it("states the refund window as a number of days", () => {
    expect(text("refund-policy").toLowerCase()).toContain("fourteen days");
  });

  it("answers what happens once the event has already taken place", () => {
    const refunds = text("refund-policy").toLowerCase();
    expect(refunds).toContain("already happened");
    expect(refunds).toContain("chargeback");
  });

  it("names every company that touches the data", () => {
    const privacy = text("privacy");
    for (const processor of [
      "Supabase",
      "Amazon Web Services",
      "Vercel",
      "Lemon Squeezy",
      "Resend",
    ]) {
      expect(privacy).toContain(processor);
    }
  });

  it("states where the files are and how long they stay", () => {
    const privacy = text("privacy");
    expect(privacy).toContain("European Union");
    // Read from the constants the retention job enforces, so the policy cannot
    // drift away from what the product actually does.
    expect(privacy).toContain(String(TIERS.free.retentionDays));
    expect(privacy).toContain(String(HARD_DELETE_GRACE_DAYS));
  });

  it("gives someone in a photo a way to have it removed", () => {
    const privacy = text("privacy").toLowerCase();
    expect(privacy).toContain("did not upload it");
    expect(privacy).toContain("hours");
  });

  it("bans the four things an acceptable use policy has to ban", () => {
    const rules = text("acceptable-use").toLowerCase();
    expect(rules).toContain("illegal");
    expect(rules).toContain("sexual content");
    expect(rules).toContain("consent");
    expect(rules).toMatch(/guardian/);
  });

  it("gives a takedown address and a stated response time", () => {
    const rules = text("acceptable-use");
    expect(rules).toMatch(/[\w.]+@[\w.]+/);
    expect(rules).toMatch(/within \d+ hours/);
  });
});

describe("what the product must not say", () => {
  /*
   * A "contact us for a quote" line is the clearest signal that a business
   * sells services rather than software, and it is what got this store read as
   * an agency the first time round.
   */
  it("never invites anyone to negotiate a price", () => {
    expect(everything.toLowerCase()).not.toContain("contact us for");
    expect(everything.toLowerCase()).not.toContain("request a quote");
    expect(everything.toLowerCase()).not.toContain("custom quote");
  });

  it("says plainly that nothing recurs", () => {
    const terms = text("terms").toLowerCase();
    expect(terms).toContain("nothing renews");
    expect(terms).toContain("no subscription");
  });
});
