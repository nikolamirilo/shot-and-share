import "server-only";

import { ApiError } from "@/lib/api";
import { findEvent } from "@/lib/db/event-repo";
import { type EventRow } from "@/types/db";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ApiError("unauthorized", "Sign in first.");
  return { supabase, user };
}

export async function requireOwnedEvent(id: string): Promise<EventRow> {
  const { supabase } = await requireUser();

  const event = await findEvent(supabase, id);
  if (!event) throw new ApiError("not_found", "Event not found.");
  return event;
}
