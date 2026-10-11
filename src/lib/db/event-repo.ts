import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type Database, type EventRow } from "@/types/db";

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

export async function listOwnEvents(client: Client): Promise<EventRow[]> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

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

export async function listExpiringEvents(
  client: Client,
  horizon: string,
  limit: number,
): Promise<EventWithOwnerEmail[]> {
  const { data } = await withOwnerEmail(client).lte("expires_at", horizon).limit(limit);
  return (data ?? []) as unknown as EventWithOwnerEmail[];
}

export async function listExpiredEvents(
  client: Client,
  now: string,
  limit: number,
): Promise<EventWithOwnerEmail[]> {
  const { data } = await withOwnerEmail(client).lt("expires_at", now).limit(limit);
  return (data ?? []) as unknown as EventWithOwnerEmail[];
}

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
