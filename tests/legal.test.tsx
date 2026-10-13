import { describe, expect, it } from "vitest";

import { LEGAL_ORDER, LEGAL_PAGES } from "@/lib/legal/pages";
import { OPERATOR, addressLine } from "@/lib/legal/operator";
import { PUBLIC_ROUTES } from "@/lib/seo";
import { HARD_DELETE_GRACE_DAYS, TIERS } from "@/lib/tiers";

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
    expect(text("privacy")).toContain(OPERATOR.legalName);
    expect(text("privacy")).toContain(OPERATOR.registrationNumber);
  });
});

describe("the answers a reviewer is actually looking for", () => {
  it("does not promise a pro-rated upgrade", () => {
    const terms = text("terms").toLowerCase();
    expect(terms).not.toContain("charges the difference");
    expect(terms).not.toContain("pro-rat");
    expect(terms).not.toContain("prorat");
  });

  it("says an upgrade costs the new plan's full price", () => {
    const terms = text("terms");
    expect(terms).toContain("in full");
    expect(terms).toContain(`costs €${TIERS.pro.priceEur}`);
    expect(terms).toContain("nothing is refunded");
  });

  it("states how many events the free plan holds", () => {
    expect(text("terms")).toContain("holds one event at a time");
  });

  it("says which day the upgraded window is counted from", () => {
    expect(text("terms")).toContain("counted from the day you upgraded");
  });

  it("states the refund window as a number of days", () => {
    expect(text("refund").toLowerCase()).toContain("fourteen days");
  });

  it("answers what happens once the event has already taken place", () => {
    const refunds = text("refund").toLowerCase();
    expect(refunds).toContain("already happened");
    expect(refunds).toContain("chargeback");
  });

  it("states where the files are and how long they stay", () => {
    const privacy = text("privacy");
    expect(privacy).toContain("European Union");
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
  it("never invites anyone to negotiate a price", () => {
    expect(everything.toLowerCase()).not.toContain("contact us for");
    expect(everything.toLowerCase()).not.toContain("request a quote");
    expect(everything.toLowerCase()).not.toContain("custom quote");
  });
});
