import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountMenu } from "@/components/layout/account-menu";
import { Wordmark } from "@/components/layout/logo";
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

  const meta = user.user_metadata ?? {};
  const name = (meta.full_name as string | undefined) ?? null;
  /* Google sends `picture`; most other providers and our own profiles trigger
     write `avatar_url`. Either is the same photograph. */
  const avatarUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;

  return (
    <div className="flex min-h-dvh flex-col bg-butter">
      {/* Four things competed for about 300 usable pixels here and the loser
          was "New event", which wrapped onto two lines and doubled in height.
          Two of them are now one 40px circle - the name and the sign-out link
          both live behind the badge - and the wordmark still gives up its word
          below xs so the row never has to wrap. */}
      <header className="relative z-10 bg-butter shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
          <Link
            href="/dashboard"
            aria-label="Say Cheese dashboard"
            className="shrink-0"
          >
            <Wordmark labelClassName="hidden xs:inline" />
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <ButtonLink
              href="/dashboard/events/new"
              size="sm"
              className="whitespace-nowrap"
            >
              New event
            </ButtonLink>
            <AccountMenu
              name={name}
              email={user.email ?? null}
              avatarUrl={avatarUrl}
            />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-butter">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind sm:px-5">
          Say Cheese · every photo from every guest
        </p>
      </footer>
    </div>
  );
}
