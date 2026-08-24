import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { hasSupabase } from "@/lib/env";

/**
 * Declared once here so it covers every page in the segment, including ones
 * added later. robots.txt disallows the path too; this is what applies when a
 * URL is reached some other way, such as a social preview.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Nothing but the segment-wide rules: no deployment without Supabase has a
 * dashboard to show, and nothing under here is for a search engine.
 *
 * The header, the footer and the sign-in check live one level down in
 * `(shell)`, because the slideshow is in this segment and must not have them.
 * It is projected on a wall: a navigation bar across the top of somebody's
 * wedding is the whole reason the split exists.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabase) redirect("/login");
  return <>{children}</>;
}
