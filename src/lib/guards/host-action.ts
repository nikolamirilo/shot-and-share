import "server-only";

import { redirect } from "next/navigation";

import { findEvent } from "@/lib/db/event-repo";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * RLS would already stop a cross-tenant write; failing early beats a silent zero-row
 * update.
 */
export async function requireOwnedEvent(eventId: string) {
  const { supabase, user } = await requireUser();
  const event = await findEvent(supabase, eventId);
  if (!event) throw new Error("Event not found.");
  return { supabase, user, event };
}
