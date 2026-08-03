import Link from "next/link";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/logo";
import { ButtonLink } from "@/components/ui";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabase) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "Host";

  return (
    <div className="flex min-h-dvh flex-col bg-butter">
      <header className="border-b-2 border-pepper bg-butter">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/dashboard" aria-label="Say Cheese dashboard">
            <Wordmark />
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind sm:block">
              {name}
            </span>
            <ButtonLink href="/dashboard/events/new" size="sm">
              New event
            </ButtonLink>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-[0.9375rem] font-semibold underline decoration-2 underline-offset-4 decoration-rind hover:decoration-pepper"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t-2 border-pepper bg-butter">
        <p className="mx-auto max-w-6xl px-5 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
          Say Cheese · every photo from every guest
        </p>
      </footer>
    </div>
  );
}
