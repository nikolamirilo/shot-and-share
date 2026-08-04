import type { Metadata } from "next";
import Link from "next/link";

import { ForgotForm } from "@/app/login/forgot/forgot-form";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Eyebrow } from "@/components/ui";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <>
      <SiteHeader />
      <main className="bg-butter">
        <div className="mx-auto max-w-md px-5 py-16 lg:py-24">
          <Eyebrow>Hosts only</Eyebrow>
          <h1 className="mt-3 text-h1">Reset your password</h1>
          <p className="mt-4 text-body text-crust">
            Type the address you signed up with and we will send a link.
          </p>

          <div className="mt-8">
            <ForgotForm />
          </div>

          <p className="mt-6 text-[0.9375rem]">
            <Link
              href="/login"
              className="font-semibold underline decoration-2 decoration-rind underline-offset-4 hover:decoration-pepper"
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
