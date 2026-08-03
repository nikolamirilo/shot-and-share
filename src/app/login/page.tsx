import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginPanel } from "@/app/login/login-panel";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Eyebrow, Hole } from "@/components/ui";
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
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <Eyebrow>Hosts only</Eyebrow>
            <h1 className="mt-3 text-h1">
              Sign in once. Your guests never have to.
            </h1>
            <p className="mt-4 max-w-md text-body text-crust">
              The only account in this product is yours. Guests open a link and
              upload — no sign-in, no app, nothing to remember.
            </p>

            <ul className="mt-8 space-y-3">
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

          <LoginPanel next={next} error={error} configured={hasSupabase} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
