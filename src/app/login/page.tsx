import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginPanel } from "@/components/auth/login-panel";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Eyebrow, Hole } from "@/components/ui";
import { loginErrorMessage } from "@/lib/auth";
import { hasSupabase } from "@/lib/env";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

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
      <main className="bg-butter">
        {/* `min-w-0` on both columns: a grid track sizes to its content's
            minimum, and an environment variable name with no spaces in it is
            wider than a small phone. Without this the whole page scrolls
            sideways to accommodate one word. */}
        <div className="mx-auto grid max-w-5xl items-center gap-9 px-4 py-11 sm:gap-12 sm:px-5 sm:py-16 lg:grid-cols-2 lg:py-24">
          <div className="min-w-0">
            <Eyebrow>Hosts only</Eyebrow>
            <h1 className="mt-3 text-[2.25rem] sm:text-h1">
              Sign in once. Your guests never have to.
            </h1>
            <p className="mt-4 max-w-md text-body text-crust">
              The only account in this product is yours. Guests open a link and
              upload - no sign-in, no app, nothing to remember.
            </p>

            <ul className="mt-7 space-y-3 sm:mt-8">
              {[
                "Create an event in under a minute",
                "Free plan holds about 250 photos",
                "No card needed to start",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Hole size={11} className="mt-2" />
                  <span className="text-[0.9375rem]">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <LoginPanel
              next={next}
              error={loginErrorMessage(error)}
              configured={hasSupabase}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
