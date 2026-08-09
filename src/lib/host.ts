import "server-only";

import { ApiError } from "@/lib/api";
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
 * The event, if the signed-in host owns it.
 *
 * Row Level Security would already refuse a cross-tenant read, so the select
 * finding nothing is the check rather than a second comparison of owner ids.
 * What this adds is a clear answer: "sign in" and "no such event" are different
 * problems with different fixes, and a route that only knew it had no row would
 * have to guess which one to say.
 *
 * Every host-side API route goes through here - which was not true when this
 * comment first claimed it: qr, checkout, dev/checkout each had a copy of the
 * body below, and latest/ had no ownership step at all and leaned on RLS alone.
 *
 * The server actions keep a separate guard in @/lib/actions/guards. That is
 * deliberate rather than duplication left lying around: the two differ in how
 * they refuse, and a form needs a redirect where a fetch needs a status.
 */
export async function requireOwnedEvent(id: string): Promise<EventRow> {
  const { supabase } = await requireUser();

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new ApiError("not_found", "Event not found.");
  return data as EventRow;
}
