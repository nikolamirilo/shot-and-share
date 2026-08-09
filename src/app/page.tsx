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
import { hasSupabase } from "@/lib/env";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Say Cheese - every photo from every guest, at any event",
};

export default async function LandingPage() {
  const user = hasSupabase ? await getSessionUser() : null;
  const signedIn = Boolean(user);

  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main>
        <Hero signedIn={signedIn} />
        <LogoStrip />
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
