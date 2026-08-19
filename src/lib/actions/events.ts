"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOwnedEvent, requireUser } from "@/lib/actions/guards";
import type { ActionState } from "@/lib/actions/types";
import { LIMITS, rateLimit } from "@/lib/ratelimit";
import { issueTokenFor } from "@/lib/share-tokens";
import { TIERS, computeExpiry, getTier } from "@/lib/tiers";

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
      expires_at: computeExpiry(parsed.data.event_date, tier).toISOString(),
      status: "active",
      gallery_visible: true,
      // Off, and it stays off unless a host asks for it. Making somebody
      // approve four hundred wedding photographs one at a time would ruin the
      // product for the people who never think about moderation at all.
      require_approval: false,
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

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gallery_visible: z.boolean(),
  require_approval: z.boolean(),
  welcome_message: z.string().trim().max(400).nullable(),
});

export async function updateEventSettings(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, event } = await requireOwnedEvent(eventId);

  const welcome = String(formData.get("welcome_message") ?? "").trim();
  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    event_date: formData.get("event_date"),
    gallery_visible: formData.get("gallery_visible") === "on",
    require_approval: formData.get("require_approval") === "on",
    welcome_message: welcome.length > 0 ? welcome : null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message ?? "Check the form." };
  }

  // Retention is measured from the event date, so moving the date moves expiry.
  const expiresAt = event.keep_forever
    ? null
    : computeExpiry(parsed.data.event_date, getTier(event.tier)).toISOString();

  const { error } = await supabase
    .from("events")
    .update({
      name: parsed.data.name,
      event_date: parsed.data.event_date,
      gallery_visible: parsed.data.gallery_visible,
      require_approval: parsed.data.require_approval,
      welcome_message: parsed.data.welcome_message,
      expires_at: expiresAt,
    })
    .eq("id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}
