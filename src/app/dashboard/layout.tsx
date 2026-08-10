import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountMenu } from "@/components/layout/account-menu";
import { Wordmark } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui";
import { hasSupabase } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Nothing under /dashboard is for a stranger, and the pages here are all
 * redirects to /login for anyone who is not signed in. Declaring it once in the
 * layout covers every page in the segment, including any added later - the
 * child pages set only a title and inherit this.
 *
 * robots.txt disallows the path as well, which stops the crawl before it
 * starts; this is the directive that applies if a URL is reached some other
 * way, such as being pasted into a social preview.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

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
    <div className="flex min-h-dvh flex-col bg-linen">
      {/* Four things competed for about 300 usable pixels here and the loser
          was "New event", which wrapped onto two lines and doubled in height.
          Two of them are now one 40px circle - the name and the sign-out link
          both live behind the badge - and the wordmark still gives up its word
          below xs so the row never has to wrap.

          The mark goes home, not to the dashboard. A logo that means "the top
          of this app" in one place and "the front of this site" in another is
          a logo a person cannot use, and every other site they visit has
          taught them it is the way out. "My events" is what carries them back
          into the app instead - it appears from xs up, where there is room
          for a third thing, and below that the pages that need it have their
          own way back. */}
      <header className="relative z-10 bg-linen shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
          <Link href="/" aria-label="Shot & Share, home" className="shrink-0">
            <Wordmark labelClassName="hidden xs:inline" />
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/dashboard"
              className="hidden whitespace-nowrap text-[0.9375rem] font-semibold hover:underline xs:inline"
            >
              My events
            </Link>
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

      <footer className="bg-linen">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist sm:px-5">
          Shot & Share · every photo from every guest
        </p>
      </footer>
    </div>
  );
}
