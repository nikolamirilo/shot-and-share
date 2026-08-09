import "server-only";

import { ApiError } from "@/lib/api";
import type { EventRow } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

/**
 * The event, if the signed-in host owns it.
 *
 * Row Level Security would already refuse a cross-tenant read, so the select
 * finding nothing is the check rather than a second comparison of owner ids.
 * What this adds is a clear answer: "sign in" and "no such event" are different
 * problems with different fixes, and a route that only knew it had no row would
 * have to guess which one to say.
 *
 * Every host-side API route goes through here. The server actions in
 * app/dashboard/actions.ts keep their own copy: those throw plain Errors into a
 * form, not ApiErrors into a JSON body.
 */
export async function requireOwnedEvent(id: string): Promise<EventRow> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("unauthorized", "Sign in first.");

  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new ApiError("not_found", "Event not found.");
  return data as EventRow;
}
