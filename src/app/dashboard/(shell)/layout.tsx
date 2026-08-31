import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { createClient } from "@/lib/supabase/server";

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
  const avatarUrl =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;

  return (
    <div className="flex min-h-dvh flex-col bg-linen">
      <DashboardHeader
        name={name}
        email={user.email ?? null}
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
