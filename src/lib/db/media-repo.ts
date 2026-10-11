import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type Database, type MediaKind, type MediaRow } from "@/types/db";
import { type GallerySort } from "@/constants/gallery";
import { parseTakenCursor, takenCursor } from "@/utils/media-view";

type Client = SupabaseClient<Database>;

export function guestMedia(client: Client, eventId: string) {
  return client
    .from("media")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "ready")
    .eq("source", "guest")
    .order("created_at", { ascending: false });
}

export function visibleGuestMedia(client: Client, eventId: string) {
  return guestMedia(client, eventId).eq("review_state", "approved");
}

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
  nextCursor: string | null;
}

export async function listGuestPage(
  client: Client,
  {
    eventId,
    before,
    pageSize,
    kind,
    sort = "added",
  }: {
    eventId: string;
    before?: string | null;
    pageSize: number;
    kind?: MediaKind | null;
    sort?: GallerySort;
  },
): Promise<MediaPage> {
  let query =
    sort === "taken"
      ? client
          .from("media")
          .select("*")
          .eq("event_id", eventId)
          .eq("status", "ready")
          .eq("source", "guest")
          .eq("review_state", "approved")
          .order("sort_taken_at", { ascending: false })
          .order("id", { ascending: false })
      : visibleGuestMedia(client, eventId);
  query = query.limit(pageSize);
  if (kind) query = query.eq("kind", kind);

  if (before && sort === "taken") {
    const cursor = parseTakenCursor(before);
    // A bad cursor is page one, never a filter: it goes into a PostgREST expression.
    if (cursor) {
      query = query.or(
        `sort_taken_at.lt."${cursor.at}",and(sort_taken_at.eq."${cursor.at}",id.lt.${cursor.id})`,
      );
    }
  } else if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as MediaRow[];
  const last = rows[rows.length - 1];
  return {
    rows,
    nextCursor:
      rows.length === pageSize
        ? sort === "taken"
          ? takenCursor({ takenAt: last.sort_taken_at, id: last.id })
          : last.created_at
        : null,
  };
}

export async function listVisibleGuestMediaByIds(
  client: Client,
  eventId: string,
  ids: string[],
): Promise<MediaRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await visibleGuestMedia(client, eventId).in(
    "id",
    ids,
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as MediaRow[];
}

export async function countVisibleGuestMedia(
  client: Client,
  eventId: string,
  kind: MediaKind,
): Promise<number | null> {
  const { count, error } = await client
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "ready")
    .eq("source", "guest")
    .eq("review_state", "approved")
    .eq("kind", kind);
  if (error) {
    console.error("[gallery] could not count the event", error.message);
    return null;
  }
  return count ?? null;
}

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

  if (data === null || data === undefined) return null;

  const count = Number(data);
  return Number.isFinite(count) ? count : null;
}

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
