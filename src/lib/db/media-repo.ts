import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, MediaRow } from "@/lib/db/types";

/**
 * The one fact worth centralising about reading photographs.
 *
 * "A photograph of the party" is three predicates - this event, finished
 * processing, uploaded by a guest - and they were spelled out at seven call
 * sites across pages, routes and actions, each carrying its own copy of the
 * comment explaining why `source` is checked. Adding a third media source meant
 * editing seven places and hoping. Now it means editing this.
 *
 * The client is a parameter rather than an import. Some callers hold the RLS
 * client that proved ownership; others hold the admin client because they are
 * serving a guest who has no session at all. Which one is right is the caller's
 * decision, and not one this module should quietly make for them.
 */
type Client = SupabaseClient<Database>;

/** Guest photographs at one event, newest first, before any paging. */
export function guestMedia(client: Client, eventId: string) {
  return client
    .from("media")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "ready")
    // A cover the host uploaded lives in the same table and the same folder,
    // but it is not a photograph of the party - see migration 0013.
    .eq("source", "guest")
    .order("created_at", { ascending: false });
}

/** Covers the host uploaded themselves, newest first. */
export function coverMedia(client: Client, eventId: string) {
  return client
    .from("media")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "ready")
    .eq("source", "cover")
    .order("created_at", { ascending: false });
}

export interface MediaPage {
  rows: MediaRow[];
  /** Feed back as `before` for the next page. Null at the end. */
  nextCursor: string | null;
}

/**
 * One page of guest photographs, on a keyset cursor.
 *
 * Keyset rather than offset because the list grows at the head all night: an
 * offset page two would repeat photographs pushed down by new arrivals. The
 * page size is the caller's - the gallery and the cover picker want different
 * numbers - and it is also what decides whether there is a next cursor, so it
 * cannot be a constant in here.
 */
export async function listGuestPage(
  client: Client,
  {
    eventId,
    before,
    pageSize,
  }: { eventId: string; before?: string | null; pageSize: number },
): Promise<MediaPage> {
  let query = guestMedia(client, eventId).limit(pageSize);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as MediaRow[];
  return {
    rows,
    nextCursor:
      rows.length === pageSize ? rows[rows.length - 1].created_at : null,
  };
}

/** One media row, but only if it belongs to the event named. */
export async function findEventMedia(
  client: Client,
  { id, eventId }: { id: string; eventId: string },
): Promise<MediaRow | null> {
  const { data } = await client
    .from("media")
    .select("*")
    .eq("id", id)
    .eq("event_id", eventId)
    .eq("status", "ready")
    .maybeSingle();
  return (data as MediaRow | null) ?? null;
}
