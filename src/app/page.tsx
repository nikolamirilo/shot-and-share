import type { Metadata } from "next";

import { ClosingCta } from "@/components/marketing/ClosingCta";
import { Faq } from "@/components/marketing/Faq";
import { Hero } from "@/components/marketing/Hero";
import { PricingSection } from "@/components/marketing/PricingSection";
import { Problem } from "@/components/marketing/Problem";
import { Proof } from "@/components/marketing/Proof";
import { Steps } from "@/components/marketing/Steps";
import { StickyCta } from "@/components/marketing/StickyCta";
import { Why } from "@/components/marketing/Why";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { hasSupabase } from "@/lib/env";
import {
  SITE,
  faqSchema,
  graph,
  softwareApplicationSchema,
} from "@/lib/seo";
import { getSessionUser, headerUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `${SITE.name} - every photo your guests take`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default async function LandingPage() {
  const user = hasSupabase ? await getSessionUser() : null;
  const signedIn = Boolean(user);
  const ctaHref = signedIn ? "/dashboard" : "/signup";

  return (
    <>
      <JsonLd
        id="ld-home"
        json={graph(softwareApplicationSchema(), faqSchema())}
      />

      <SiteHeader user={headerUser(user)} />
      <main>
        <Hero signedIn={signedIn} />
        <Problem />
        <Steps signedIn={signedIn} />
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
