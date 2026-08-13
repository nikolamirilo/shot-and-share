import "server-only";

import { ApiError } from "@/lib/api";
import { findEvent } from "@/lib/db/event-repo";
import type { EventRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in host, for a route that answers in JSON.
 *
 * Separate from the guard in @/lib/actions/guards, which redirects to the login
 * page. A fetch cannot follow a redirect to an HTML page and do anything useful
 * with it, so this throws instead and `handle()` turns it into a 401.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("unauthorized", "Sign in first.");
  return { supabase, user };
}

/**
 * The event, if the signed-in host owns it. Every host-side API route goes
 * through here.
 *
 * RLS would already refuse a cross-tenant read, so the select finding nothing
 * is the check rather than a second comparison of owner ids. What this adds is
 * a clear answer: "sign in" and "no such event" have different fixes.
 *
 * The server actions keep a separate guard in @/lib/actions/guards - the two
 * differ in how they refuse, and a form needs a redirect where a fetch needs a
 * status.
 */
export async function requireOwnedEvent(id: string): Promise<EventRow> {
  const { supabase } = await requireUser();

  const event = await findEvent(supabase, id);
  if (!event) throw new ApiError("not_found", "Event not found.");
  return event;
}
