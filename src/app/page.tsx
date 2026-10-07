import type { Metadata } from "next";

import { ClosingCta } from "@/components/marketing/closing-cta";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { LogoStrip } from "@/components/marketing/logo-strip";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Problem } from "@/components/marketing/problem";
import { Proof } from "@/components/marketing/proof";
import { Steps } from "@/components/marketing/steps";
import { StickyCta } from "@/components/marketing/sticky-cta";
import { ThreeScreens } from "@/components/marketing/three-screens";
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

export const metadata: Metadata = {
  title: `${SITE.name} - every photo your guests take`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

/**
 * In the order a visitor's questions come: what is it, can I trust it, why
 * would I need it, how does it work, show me, why this one, who else uses it,
 * what does it cost, and the objections that are left.
 */
export default async function LandingPage() {
  const user = hasSupabase ? await getSessionUser() : null;
  const signedIn = Boolean(user);
  const ctaHref = signedIn ? "/dashboard" : "/login";

  return (
    <>
      {/* The application and its prices, plus the questions that are actually
          on the page below. Both are built from the same constants the page
          renders, so the markup cannot promise a price or an answer a visitor
          will not find. */}
      <JsonLd
        id="ld-home"
        json={graph(softwareApplicationSchema(), faqSchema())}
      />

      <SiteHeader signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <LogoStrip />
        <Problem />
        <Steps signedIn={signedIn} />
        <ThreeScreens />
        <Why />
        <Proof />
        <PricingSection ctaHref={ctaHref} />
        <Faq />
        <ClosingCta signedIn={signedIn} />
      </main>
      <SiteFooter />
      <StickyCta href={ctaHref} />
    </>
  );
}
