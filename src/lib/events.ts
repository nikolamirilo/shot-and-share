import "server-only";

import type { EventRow, MediaRow } from "@/lib/db/types";
import { ApiError } from "@/lib/api";
import { decryptToken } from "@/lib/crypto";
import { hasSupabase } from "@/lib/env";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken, looksLikeToken } from "@/lib/tokens";
import { getTier } from "@/lib/tiers";

export interface GuestContext {
  event: EventRow;
  tokenId: string;
}

/**
 * The guest side has no session, so this is the entire authorisation model:
 * a high-entropy token, hashed at rest, that maps to exactly one event.
 */
export async function resolveGuestToken(
  token: string,
): Promise<GuestContext | null> {
  if (!looksLikeToken(token)) return null;

  // A guest standing in a venue must never see a stack trace. If the backend is
  // misconfigured they get the same "this link is not working" page as a
  // revoked token, and the operator gets the noise in the logs.
  if (!hasSupabase) {
    console.error("[guest] Supabase is not configured; refusing every link.");
    return null;
  }

  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("event_tokens")
    .select("id, event_id, revoked")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!tokenRow || tokenRow.revoked) return null;

  const { data: event } = await admin
    .from("events")
    .select("*")
    .eq("id", tokenRow.event_id)
    .maybeSingle();

  if (!event) return null;
  return { event: event as EventRow, tokenId: tokenRow.id };
}

export type GuestGate =
  | { state: "open"; event: EventRow }
  | { state: "expired"; event: EventRow }
  | { state: "closed"; event: EventRow };

export function gateGuest(event: EventRow): GuestGate {
  if (event.status !== "active") return { state: "expired", event };
  if (event.expires_at && new Date(event.expires_at) < new Date()) {
    return { state: "expired", event };
  }
  return { state: "open", event };
}

/** Throws the same error shape the API routes already know how to render. */
export async function requireGuestEvent(token: string): Promise<GuestContext> {
  const ctx = await resolveGuestToken(token);
  if (!ctx) {
    throw new ApiError("not_found", "This link is not valid any more.");
  }
  const gate = gateGuest(ctx.event);
  if (gate.state !== "open") {
    throw new ApiError(
      "gone",
      "This event has closed and is no longer accepting photos.",
    );
  }
  return ctx;
}

export interface MediaView {
  id: string;
  kind: MediaRow["kind"];
  width: number | null;
  height: number | null;
  createdAt: string;
  uploaderName: string | null;
  uploaderFingerprint: string | null;
  sizeBytes: number;
  thumbUrl: string | null;
  /** Only resolved when a photo is opened, never for a whole gallery page. */
  originalUrl?: string;
}

/**
 * Thumbnails go out through the CDN with a long cache: the id is unguessable
 * and the event link is already the access control. Originals are always
 * signed and short-lived, so a leaked image link stops working.
 */
export async function toMediaView(
  row: MediaRow,
  opts: { withOriginal?: boolean } = {},
): Promise<MediaView> {
  const thumbUrl = row.thumb_key
    ? (storage.publicUrl(row.thumb_key) ??
      (await storage.presignDownload({
        key: row.thumb_key,
        expiresInSeconds: 3600,
      })))
    : null;

  const view: MediaView = {
    id: row.id,
    kind: row.kind,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    uploaderName: row.uploader_name,
    uploaderFingerprint: row.uploader_fingerprint,
    sizeBytes: row.size_bytes,
    thumbUrl,
  };

  if (opts.withOriginal) {
    view.originalUrl = await storage.presignDownload({
      key: row.original_key,
      expiresInSeconds: 900,
    });
  }

  return view;
}

export async function toMediaViews(rows: MediaRow[]): Promise<MediaView[]> {
  return Promise.all(rows.map((row) => toMediaView(row)));
}

export function storageSummary(event: EventRow) {
  const tier = getTier(event.tier);
  const used = Number(event.storage_used_bytes);
  const quota = Number(event.storage_quota_bytes);
  return {
    tier,
    used,
    quota,
    remaining: Math.max(0, quota - used),
    percent: quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0,
    full: used >= quota,
  };
}

export const GALLERY_PAGE_SIZE = 48;

/**
 * The live share link for an event, decrypted so the dashboard can render the
 * QR code. Returns null when the host has revoked every link — which is the
 * point of revoking, so callers must handle it rather than reissue silently.
 */
export async function getActiveShareToken(
  eventId: string,
): Promise<{ token: string; tokenId: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("event_tokens")
    .select("id, token_cipher")
    .eq("event_id", eventId)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.token_cipher) return null;
  const token = decryptToken(data.token_cipher);
  return token ? { token, tokenId: data.id } : null;
}
