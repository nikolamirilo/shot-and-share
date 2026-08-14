import "server-only";

import { redirect } from "next/navigation";

import { findEvent } from "@/lib/db/event-repo";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in host, or a redirect to the login page.
 *
 * Not a `"use server"` module. These are guards the actions call, and exporting
 * them from an action file would publish them as endpoints of their own.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * The event, if the signed-in host owns it, plus the client that proved it -
 * so a mutation authenticates once rather than twice. Every host mutation goes
 * through this.
 *
 * RLS would already stop a cross-tenant write; failing early with a clear error
 * beats a silent zero-row update.
 *
 * @/lib/host has the same lookup for API routes, deliberately separate: that
 * one throws ApiError into a JSON body, this one redirects into a form.
 */
export async function requireOwnedEvent(eventId: string) {
  const { supabase, user } = await requireUser();
  const event = await findEvent(supabase, eventId);
  if (!event) throw new Error("Event not found.");
  return { supabase, user, event };
}
