import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { hasSupabase } from "@/lib/env";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabase) redirect("/login");
  return <>{children}</>;
}
