import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/components/auth/PasswordForm";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Eyebrow } from "@/components/ui";
import { hasSupabase } from "@/lib/env";
import { getSessionUser, headerUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default async function PasswordPage() {
  if (!hasSupabase) redirect("/login");

  const user = await getSessionUser();
  if (!user) redirect("/login?error=session_expired");

  return (
    <>
      <SiteHeader user={headerUser(user)} />
      <main className="bg-linen">
        <div className="mx-auto max-w-md px-4 py-11 sm:px-5 sm:py-16 lg:py-24">
          <Eyebrow>Hosts only</Eyebrow>
          <h1 className="mt-3 text-[2.25rem] sm:text-h1">Set a new password</h1>
          <p className="mt-4 text-body text-ash">
            Signed in as {user.email}. This replaces any password on the account.
          </p>

          <div className="mt-8">
            <PasswordForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
