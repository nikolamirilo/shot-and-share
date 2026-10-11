import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { getHeaderUser } from "@/lib/supabase/server";

export default async function DashboardShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getHeaderUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col bg-linen">
      <SiteHeader user={user} />

      <main className="flex-1">{children}</main>

      <footer className="bg-linen">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist sm:px-5">
          Shot & Share · every photo from every guest
        </p>
      </footer>
    </div>
  );
}
