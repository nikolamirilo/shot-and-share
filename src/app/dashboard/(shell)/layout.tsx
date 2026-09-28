import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /*
   * Claims, not getUser. getUser is a round trip to the auth server, and this
   * layout sits in front of every dashboard page - so every tap on "My events"
   * waited on it before anything could draw, loading skeleton included. The
   * claims are the signed session token, checked against the project's keys,
   * which is the same proof without the wait. The middleware has already
   * refreshed the session by the time this runs.
   */
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta.full_name as string | undefined) ?? null;
  const avatarUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;

  return (
    <div className="flex min-h-dvh flex-col bg-linen">
      <DashboardHeader
        name={name}
        email={claims.email ?? null}
        avatarUrl={avatarUrl}
      />

      <main className="flex-1">{children}</main>

      <footer className="bg-linen">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist sm:px-5">
          Shot & Share · every photo from every guest
        </p>
      </footer>
    </div>
  );
}
