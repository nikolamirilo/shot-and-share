import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginPanel } from "@/components/auth/LoginPanel";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { loginErrorMessage } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to create an event and collect photos from your guests. Hosts only - guests never need an account.",
  robots: { index: false, follow: true },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  if (hasSupabase) {
    const user = await getSessionUser();
    if (user) redirect(next ?? "/dashboard");
  }

  return (
    <>
      <SiteHeader />
      <main className="bg-linen">
        <div className="mx-auto max-w-md px-4 py-11 sm:px-5 sm:py-16 lg:py-24">
          <LoginPanel
            next={next}
            error={loginErrorMessage(error)}
            configured={hasSupabase}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
