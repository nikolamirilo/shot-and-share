import type { Metadata } from "next";

import { ClosingCta } from "@/components/marketing/closing-cta";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { LogoStrip } from "@/components/marketing/logo-strip";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Steps } from "@/components/marketing/steps";
import { Why } from "@/components/marketing/why";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { JsonLd } from "@/components/seo/json-ld";
import { hasSupabase } from "@/lib/env";
import {
  SITE,
  faqSchema,
  graph,
  softwareApplicationSchema,
} from "@/lib/seo";
import { getSessionUser } from "@/lib/supabase/server";
import { HeroVariant3 } from "@/components/marketing/HeroVariant3";
import { HeroVariant2 } from "@/components/marketing/HeroVariant2";

export const metadata: Metadata = {
  title: `${SITE.name} - every photo your guests take`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default async function LandingPage() {
  const user = hasSupabase ? await getSessionUser() : null;
  const signedIn = Boolean(user);

  return (
    <>
      {/* The application and its prices, plus the six questions that are
          actually on the page below. Both are built from the same constants the
          page renders, so the markup cannot promise a price or an answer a
          visitor will not find. */}
      <JsonLd
        id="ld-home"
        json={graph(softwareApplicationSchema(), faqSchema())}
      />

      <SiteHeader signedIn={signedIn} />
      <main>
        <HeroVariant2 signedIn={false} />
        {/* <LogoStrip /> */}
        <Steps />
        <Why />
        <PricingSection />
        <Faq />
        <ClosingCta signedIn={signedIn} />
      </main>
      <SiteFooter />
    </>
  );
}
