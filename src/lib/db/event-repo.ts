import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, EventRow } from "@/lib/db/types";

/**
 * Reads of the events table. Writes stay with the action or route that owns
 * them - they each update a different set of columns, and a generic update
 * helper would only hide which.
 *
 * As in media-repo, the client is a parameter: some callers hold the RLS client
 * that proved ownership, others the admin client.
 */
type Client = SupabaseClient<Database>;

export async function findEvent(
  client: Client,
  id: string,
): Promise<EventRow | null> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventRow | null) ?? null;
}

/** Just the name, for a page title. Avoids pulling the whole row twice. */
export async function findEventName(
  client: Client,
  id: string,
): Promise<string | null> {
  const { data } = await client
    .from("events")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return data?.name ?? null;
}

/** Every event the signed-in host can see, newest date first. */
export async function listOwnEvents(client: Client): Promise<EventRow[]> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

/** An event plus its owner's email, which is all the retention job needs. */
export type EventWithOwnerEmail = EventRow & {
  profiles: { email: string | null } | null;
};

function withOwnerEmail(client: Client) {
  return client
    .from("events")
    .select("*, profiles!events_owner_id_fkey(email)")
    .eq("status", "active")
    .eq("keep_forever", false)
    .not("expires_at", "is", null);
}

/** Active events expiring inside the warning horizon. */
export async function listExpiringEvents(
  client: Client,
  horizon: string,
  limit: number,
): Promise<EventWithOwnerEmail[]> {
  const { data } = await withOwnerEmail(client).lte("expires_at", horizon).limit(limit);
  return (data ?? []) as unknown as EventWithOwnerEmail[];
}

/** Active events whose expiry has already passed. */
export async function listExpiredEvents(
  client: Client,
  now: string,
  limit: number,
): Promise<EventWithOwnerEmail[]> {
  const { data } = await withOwnerEmail(client).lt("expires_at", now).limit(limit);
  return (data ?? []) as unknown as EventWithOwnerEmail[];
}

/**
 * Events past the grace window, ready to be removed for good. owner_id comes
 * back because it is half the storage prefix, so it is not optional here.
 */
export async function listEventsToPurge(
  client: Client,
  cutoff: string,
  limit: number,
): Promise<Array<{ id: string; owner_id: string }>> {
  const { data } = await client
    .from("events")
    .select("id, owner_id")
    .eq("status", "expired")
    .eq("keep_forever", false)
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(limit);
  return data ?? [];
}
