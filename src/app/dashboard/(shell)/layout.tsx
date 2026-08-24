import Link from "next/link";
import { redirect } from "next/navigation";
import { MdAdd } from "react-icons/md";

import { AccountMenu } from "@/components/layout/account-menu";
import { Wordmark } from "@/components/layout/logo";
import { HeaderShell } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

/**
 * The console's furniture: everything a host navigates by.
 *
 * A route group rather than the segment layout, so that a page can opt out by
 * sitting outside it. The slideshow does - see `(projector)`.
 */
export default async function DashboardShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      {/* About 300 usable pixels on a phone: the name and sign-out both live
          behind one 40px badge, and the wordmark gives up its word below xs so
          the row never wraps.

          The mark goes home, not to the dashboard - every other site has taught
          people it is the way out. "My events" carries them back in, from xs up.

          The card is the marketing header's, because signing in is not a change
          of product. It does not follow the page down: the tab rails inside
          pin themselves to the viewport and would run underneath it. */}
      <HeaderShell className="relative z-10">
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
            <MdAdd aria-hidden className="shrink-0 text-[1.25em]" />
            New event
          </ButtonLink>
          <AccountMenu
            name={name}
            email={user.email ?? null}
            avatarUrl={avatarUrl}
          />
        </div>
      </HeaderShell>

      <main className="flex-1">{children}</main>

      <footer className="bg-linen">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist sm:px-5">
          Shot & Share · every photo from every guest
        </p>
      </footer>
    </div>
  );
}
