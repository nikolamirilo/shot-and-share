import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/app/account/password/password-form";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Eyebrow } from "@/components/ui";
import { hasSupabase } from "@/lib/env";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set a new password" };

/**
 * Reached from a recovery link, which /auth/confirm has already turned into a
 * session. A host who is simply signed in can also use it to give a
 * Google-created account a password.
 */
export default async function PasswordPage() {
  if (!hasSupabase) redirect("/login");

  const user = await getSessionUser();
  if (!user) redirect("/login?error=session_expired");

  return (
    <>
      <SiteHeader />
      <main className="bg-butter">
        <div className="mx-auto max-w-md px-5 py-16 lg:py-24">
          <Eyebrow>Hosts only</Eyebrow>
          <h1 className="mt-3 text-h1">Set a new password</h1>
          <p className="mt-4 text-body text-crust">
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
