import type { Metadata } from "next";
import Link from "next/link";

import { ForgotForm } from "@/components/auth/ForgotForm";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Eyebrow } from "@/components/ui";
import { getHeaderUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default async function ForgotPage() {
  const user = await getHeaderUser();

  return (
    <>
      <SiteHeader user={user} />
      <main className="bg-linen">
        <div className="mx-auto max-w-md px-4 py-11 sm:px-5 sm:py-16 lg:py-24">
          <Eyebrow>Hosts only</Eyebrow>
          <h1 className="mt-3 text-[2.25rem] sm:text-h1">Reset your password</h1>
          <p className="mt-4 text-body text-ash">
            Type the address you signed up with and we will send a link.
          </p>

          <div className="mt-8">
            <ForgotForm />
          </div>

          <p className="mt-6 text-[0.9375rem]">
            <Link
              href="/login"
              className="font-semibold underline decoration-2 decoration-mist underline-offset-4 hover:decoration-ink"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
