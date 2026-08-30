import { describe, expect, it } from "vitest";

import { LEGAL_ORDER, LEGAL_PAGES } from "@/lib/legal/pages";
import { OPERATOR, addressLine } from "@/lib/legal/operator";
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
  it("lists every one in the sitemap", () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);
    for (const slug of LEGAL_ORDER) {
      expect(paths).toContain(`/${slug}`);
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
});

describe("the answers a reviewer is actually looking for", () => {
  /*
   * The terms used to promise that upgrading "charges the difference rather
   * than the full price again". Nothing in the checkout has ever done that: an
   * upgrade opens a checkout for the new plan at its own price. A payments page
   * that describes a discount the buyer does not get is the kind of thing a
   * card scheme calls a misleading term, so the claim is asserted against here
   * rather than only removed.
   */
  it("does not promise a pro-rated upgrade", () => {
    const terms = text("terms").toLowerCase();
    expect(terms).not.toContain("charges the difference");
    expect(terms).not.toContain("pro-rat");
    expect(terms).not.toContain("prorat");
  });

  it("says an upgrade costs the new plan's full price", () => {
    const terms = text("terms");
    expect(terms).toContain("in full");
    // The figure itself, so the copy cannot drift away from the price table.
    expect(terms).toContain(`costs €${TIERS.pro.priceEur}`);
    expect(terms).toContain("nothing is refunded");
  });

  /*
   * Retention counts from the event date, not the purchase date - see
   * `computeExpiry`. Somebody upgrading a week before the wedding must not read
   * this and think they have bought a window that starts today.
   */
  it("says which date the upgraded window is counted from", () => {
    expect(text("terms")).toContain("date of the event itself");
  });

  it("states the refund window as a number of days", () => {
    expect(text("refund-policy").toLowerCase()).toContain("fourteen days");
  });

  it("answers what happens once the event has already taken place", () => {
    const refunds = text("refund-policy").toLowerCase();
    expect(refunds).toContain("already happened");
    expect(refunds).toContain("chargeback");
  });

  it("states where the files are and how long they stay", () => {
    const privacy = text("privacy");
    expect(privacy).toContain("European Union");
    // Read from the constants the retention job enforces, so the policy cannot
    // drift away from what the product actually does.
    expect(privacy).toContain(String(TIERS.free.retentionDays));
    expect(privacy).toContain(String(HARD_DELETE_GRACE_DAYS));
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
});
