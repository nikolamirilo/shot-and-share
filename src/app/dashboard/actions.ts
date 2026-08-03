"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import type { EventRow } from "@/lib/db/types";
import { encryptToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { archiveKey, eventPrefix, mediaBytes, mediaKeys } from "@/lib/media";
import { LIMITS, clientIp, rateLimit } from "@/lib/ratelimit";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TIERS, computeExpiry, getTier } from "@/lib/tiers";
import { generateToken, hashToken } from "@/lib/tokens";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * Every host mutation goes through this. RLS would already stop a cross-tenant
 * write, but failing early with a clear error beats a silent zero-row update.
 */
async function requireOwnedEvent(eventId: string): Promise<EventRow> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Event not found.");
  return data as EventRow;
}

/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the event a name.")
    .max(120, "That name is too long."),
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date for the event."),
});

export async function createEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const limit = rateLimit(
    `create:${user.id}`,
    LIMITS.createEvent.limit,
    LIMITS.createEvent.window,
  );
  if (!limit.ok) {
    return { error: "That is a lot of events at once. Try again shortly." };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    event_date: formData.get("event_date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const tier = TIERS.free;
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      event_date: parsed.data.event_date,
      tier: tier.id,
      keep_forever: false,
      storage_quota_bytes: tier.quotaBytes,
      storage_used_bytes: 0,
      expires_at: computeExpiry(parsed.data.event_date, tier.id).toISOString(),
      status: "active",
      gallery_visible: true,
      welcome_message: null,
      cover_media_id: null,
      archive_key: null,
      archive_built_at: null,
      archive_size_bytes: null,
      warned_at_days: null,
      deleted_at: null,
    })
    .select("id")
    .single();

  if (error || !event) {
    return { error: error?.message ?? "Could not create the event." };
  }

  await issueTokenFor(event.id);
  revalidatePath("/dashboard");
  redirect(`/dashboard/events/${event.id}`);
}

/** Creates a fresh share link. Used at creation and when a host rotates one. */
async function issueTokenFor(eventId: string, label = "Primary link") {
  const admin = createAdminClient();
  const token = generateToken();
  const { error } = await admin.from("event_tokens").insert({
    event_id: eventId,
    token_hash: hashToken(token),
    token_cipher: encryptToken(token),
    label,
    revoked: false,
  });
  if (error) throw new Error(error.message);
  return token;
}

/* -------------------------------------------------------------------------- */

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gallery_visible: z.boolean(),
  gallery_layout: z.enum(["grid", "masonry", "holes", "stack"]),
  media_quality: z.enum(["optimised", "original"]),
  welcome_message: z.string().trim().max(400).nullable(),
});

export async function updateEventSettings(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const event = await requireOwnedEvent(eventId);
  const { supabase } = await requireUser();

  const welcome = String(formData.get("welcome_message") ?? "").trim();
  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    event_date: formData.get("event_date"),
    gallery_visible: formData.get("gallery_visible") === "on",
    gallery_layout: formData.get("gallery_layout") ?? event.gallery_layout,
    media_quality: formData.get("media_quality") ?? event.media_quality,
    welcome_message: welcome.length > 0 ? welcome : null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message ?? "Check the form." };
  }

  // Retention is measured from the event date, so moving the date moves expiry.
  const expiresAt = event.keep_forever
    ? null
    : computeExpiry(parsed.data.event_date, event.tier).toISOString();

  const { error } = await supabase
    .from("events")
    .update({
      name: parsed.data.name,
      event_date: parsed.data.event_date,
      gallery_visible: parsed.data.gallery_visible,
      gallery_layout: parsed.data.gallery_layout,
      media_quality: parsed.data.media_quality,
      welcome_message: parsed.data.welcome_message,
      expires_at: expiresAt,
    })
    .eq("id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */

/**
 * Revoke and reissue. This is how a host shuts down an event that is attracting
 * junk: the old link stops working immediately, and a new one is minted so the
 * people who should still have access can be sent it.
 */
export async function rotateShareLink(eventId: string): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("event_tokens")
    .update({ revoked: true })
    .eq("event_id", eventId)
    .eq("revoked", false);
  if (error) return { error: error.message };

  await issueTokenFor(eventId, "Reissued link");
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/** Closes the event to new uploads without minting a replacement. */
export async function revokeShareLink(eventId: string): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  const admin = createAdminClient();

  const { error } = await admin
    .from("event_tokens")
    .update({ revoked: true })
    .eq("event_id", eventId)
    .eq("revoked", false);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */

export async function deleteMedia(
  eventId: string,
  mediaIds: string[],
): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  if (mediaIds.length === 0) return { ok: true };

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("media")
    .select("*")
    .eq("event_id", eventId)
    .in("id", mediaIds)
    .neq("status", "deleted");

  if (error) return { error: error.message };
  if (!rows || rows.length === 0) return { ok: true };

  const keys = rows.flatMap((row) => mediaKeys(row));
  const bytes = rows.reduce((sum, row) => sum + mediaBytes(row), 0);

  await storage.remove(keys);
  await admin
    .from("media")
    .update({ status: "deleted" })
    .eq("event_id", eventId)
    .in(
      "id",
      rows.map((r) => r.id),
    );
  await admin.rpc("release_storage", { p_event: eventId, p_bytes: bytes });

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */

export async function setCoverPhoto(
  eventId: string,
  mediaId: string | null,
): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("events")
    .update({ cover_media_id: mediaId })
    .eq("id", eventId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */

/**
 * The host's own delete. Unlike the retention job this is immediate, because
 * the person asking for it owns the photos and has just confirmed twice.
 */
export async function deleteEvent(eventId: string): Promise<ActionState> {
  const event = await requireOwnedEvent(eventId);
  const admin = createAdminClient();

  await storage.removePrefix(eventPrefix(eventId));
  const { error } = await admin.from("events").delete().eq("id", event.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/* -------------------------------------------------------------------------- */

/**
 * Bring back an event that passed its expiry but is still inside the grace
 * window. Nothing has been removed yet at this point — that is the whole reason
 * the grace window exists.
 */
export async function restoreEvent(eventId: string): Promise<ActionState> {
  const event = await requireOwnedEvent(eventId);
  if (event.status !== "expired") return { ok: true };

  const admin = createAdminClient();
  const tier = getTier(event.tier);
  const { error } = await admin
    .from("events")
    .update({
      status: "active",
      deleted_at: null,
      warned_at_days: null,
      // A restore without a purchase gets a short window, not a full new term.
      expires_at: new Date(
        Date.now() + Math.min(30, tier.retentionDays) * 86_400_000,
      ).toISOString(),
    })
    .eq("id", eventId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */

/** Throws away a stale ZIP so the next download rebuilds it. */
export async function invalidateArchive(eventId: string): Promise<ActionState> {
  await requireOwnedEvent(eventId);
  const admin = createAdminClient();

  await storage.remove([archiveKey(eventId)]);
  await admin
    .from("events")
    .update({
      archive_key: null,
      archive_built_at: null,
      archive_size_bytes: null,
    })
    .eq("id", eventId);

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */

/** Used by the upgrade buttons to reach the payment provider. */
export async function startCheckout(
  eventId: string,
  product: "event" | "wedding" | "keep_forever",
): Promise<{ url?: string; error?: string }> {
  await requireOwnedEvent(eventId);
  const requestHeaders = await headers();

  const res = await fetch(`${env.siteUrl}/api/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: requestHeaders.get("cookie") ?? "",
      "x-forwarded-for": clientIp(requestHeaders),
    },
    body: JSON.stringify({ eventId, product }),
  });

  const body = (await res.json()) as
    | { url: string }
    | { error: { message: string } };

  if ("error" in body) return { error: body.error.message };
  return { url: body.url };
}
