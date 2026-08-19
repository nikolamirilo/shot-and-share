import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, MediaRow } from "@/lib/db/types";

/**
 * Every read of the media table.
 *
 * "A photograph of the party" is three predicates - this event, ready, uploaded
 * by a guest - and they were spelled out at a dozen call sites, each carrying
 * its own copy of the comment about migration 0013. Adding a third media source
 * meant editing all of them and hoping.
 *
 * The client is a parameter rather than an import. Some callers hold the RLS
 * client that proved ownership; others hold the admin client because they are
 * serving a guest who has no session at all.
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

/**
 * The same, narrowed to what a guest may actually see.
 *
 * Held and reported photographs are real rows on a real event, and the host has
 * to be able to look at them, so the difference between the host's view and the
 * guest's is one predicate rather than two tables. Everything guest-facing goes
 * through here; the console goes through `guestMedia` above and sees the lot.
 */
export function visibleGuestMedia(client: Client, eventId: string) {
  return guestMedia(client, eventId).eq("review_state", "approved");
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

export async function listGuestMedia(
  client: Client,
  eventId: string,
  limit: number,
): Promise<MediaRow[]> {
  const { data, error } = await guestMedia(client, eventId).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

export async function listCoverMedia(
  client: Client,
  eventId: string,
): Promise<MediaRow[]> {
  const { data, error } = await coverMedia(client, eventId);
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

/**
 * Guest photographs oldest first, which is the order the ZIP is built in.
 *
 * Approved only. A held photograph is one the host has not looked at yet, and
 * putting it into the download would quietly undo the holding.
 */
export async function listGuestMediaOldestFirst(
  client: Client,
  eventId: string,
): Promise<MediaRow[]> {
  const { data, error } = await client
    .from("media")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "ready")
    .eq("source", "guest")
    .eq("review_state", "approved")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

/**
 * Guest photographs that arrived after a timestamp. Drives the slideshow.
 *
 * Approved only, and this is the one where it matters most: the slideshow is
 * projected on a wall in front of everybody.
 */
export async function listGuestMediaSince(
  client: Client,
  eventId: string,
  since: string | null,
  limit: number,
): Promise<MediaRow[]> {
  let query = visibleGuestMedia(client, eventId).limit(limit);
  if (since) query = query.gt("created_at", since);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
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
 * numbers - and it also decides whether there is a next cursor.
 */
export async function listGuestPage(
  client: Client,
  {
    eventId,
    before,
    pageSize,
  }: { eventId: string; before?: string | null; pageSize: number },
): Promise<MediaPage> {
  let query = visibleGuestMedia(client, eventId).limit(pageSize);
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

/**
 * How many photographs the event has in total - not how many are loaded.
 *
 * Null rather than a throw when the count cannot be had. The number beside the
 * heading is the least important thing on the page, and there is no version of
 * "the gallery would not open" that is worth paying for it.
 */
export async function countGuestMedia(
  client: Client,
  eventId: string,
): Promise<number | null> {
  const { data, error } = await client.rpc("event_media_count", {
    p_event: eventId,
  });

  if (error) {
    console.error("[gallery] could not count the event", error.message);
    return null;
  }

  // Nothing at all is not zero photographs - it is a question that was never
  // answered, and "0 so far" under a wall of them is worse than no number.
  if (data === null || data === undefined) return null;

  const count = Number(data);
  return Number.isFinite(count) ? count : null;
}

/** A plain count, for the dashboard cards. Zero rather than null on failure. */
export async function countGuestMediaExact(
  client: Client,
  eventId: string,
): Promise<number> {
  const { count } = await client
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "ready")
    .eq("source", "guest");
  return count ?? 0;
}

/**
 * Guest photographs waiting on the host: flagged by the automated check, held
 * because the event holds everything, or reported by a guest.
 *
 * Oldest first. The one that has been waiting longest is the one to look at.
 */
export async function listMediaAwaitingReview(
  client: Client,
  eventId: string,
): Promise<MediaRow[]> {
  const { data, error } = await client
    .from("media")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "ready")
    .eq("source", "guest")
    .neq("review_state", "approved")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
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

/** A ready media row by id, whatever event it belongs to. Cover lookups. */
export async function findReadyMedia(
  client: Client,
  id: string,
): Promise<MediaRow | null> {
  const { data } = await client
    .from("media")
    .select("*")
    .eq("id", id)
    .eq("status", "ready")
    .maybeSingle();
  return (data as MediaRow | null) ?? null;
}

/**
 * A media row by id at any status. Only the transcode worker wants this: it
 * reports on a job it claimed, and filtering on status here would turn a row
 * deleted mid-conversion into a 404 the worker retries forever.
 */
export async function findMediaAnyStatus(
  client: Client,
  id: string,
): Promise<MediaRow | null> {
  const { data } = await client
    .from("media")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as MediaRow | null) ?? null;
}

/**
 * A row a guest may remove: theirs by fingerprint, and not already deleted.
 * The fingerprint is not authentication - it is what stops one guest's browser
 * deleting another's photo by guessing a uuid.
 */
export async function findGuestOwnMedia(
  client: Client,
  { id, eventId, fingerprint }: {
    id: string;
    eventId: string;
    fingerprint: string;
  },
): Promise<MediaRow | null> {
  const { data, error } = await client
    .from("media")
    .select("*")
    .eq("id", id)
    .eq("event_id", eventId)
    .eq("uploader_fingerprint", fingerprint)
    .neq("status", "deleted")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MediaRow | null) ?? null;
}

/** Rows named by id at one event, for a host-side delete. */
export async function findMediaByIds(
  client: Client,
  eventId: string,
  ids: string[],
): Promise<MediaRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("media")
    .select("*")
    .eq("event_id", eventId)
    .in("id", ids)
    .neq("status", "deleted");
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

/** Oldest first, so the worker drains its queue in the order it filled. */
export async function listPendingProcessing(
  client: Client,
  limit: number,
): Promise<MediaRow[]> {
  const { data, error } = await client
    .from("media")
    .select("*")
    .eq("processing", "pending")
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

/** Does this media id exist at this event? Used by the confirm retry path. */
export async function mediaExists(
  client: Client,
  { id, eventId }: { id: string; eventId: string },
): Promise<boolean> {
  const { data } = await client
    .from("media")
    .select("id")
    .eq("id", id)
    .eq("event_id", eventId)
    .maybeSingle();
  return Boolean(data);
}

/** Does a media row with this id exist at all? The reservation sweep's guard. */
export async function mediaExistsById(
  client: Client,
  id: string,
): Promise<boolean> {
  const { data } = await client
    .from("media")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return Boolean(data);
}

/** Every ready row at an event, covers included. The retention emails count. */
export async function countReadyMedia(
  client: Client,
  eventId: string,
): Promise<number> {
  const { count } = await client
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "ready");
  return count ?? 0;
}
