"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOwnedEvent, requireUser } from "@/lib/actions/guards";
import type { ActionState } from "@/lib/actions/types";
import { LIMITS, rateLimit } from "@/lib/ratelimit";
import { issueTokenFor } from "@/lib/share-tokens";
import { TIERS, computeExpiry } from "@/lib/tiers";

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the event a name.")
    .max(120, "That name is too long."),
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

  const parsed = createSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const tier = TIERS.free;
  /*
   * One instant for both columns rather than `now()` for the anchor and a
   * separate clock reading for the expiry. They are the same fact written
   * twice - the second is the first plus the plan's days - and two readings
   * either side of midnight would disagree about which day that was.
   */
  const createdAt = new Date();
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      retention_from: createdAt.toISOString(),
      tier: tier.id,
      keep_forever: false,
      storage_quota_bytes: tier.quotaBytes,
      storage_used_bytes: 0,
      expires_at: computeExpiry(createdAt, tier).toISOString(),
      status: "active",
      gallery_visible: true,
      // Off, and it stays off unless a host asks for it. Making somebody
      // approve four hundred wedding photographs one at a time would ruin the
      // product for the people who never think about moderation at all.
      require_approval: false,
      // Same reasoning, and a stronger version of it: nothing from this event
      // goes to a moderation provider until its host asks for that.
      auto_scan: false,
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
  gallery_visible: z.boolean(),
  require_approval: z.boolean(),
  auto_scan: z.boolean(),
  welcome_message: z.string().trim().max(400).nullable(),
});

export async function updateEventSettings(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireOwnedEvent(eventId);

  const welcome = String(formData.get("welcome_message") ?? "").trim();
  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    gallery_visible: formData.get("gallery_visible") === "on",
    require_approval: formData.get("require_approval") === "on",
    auto_scan: formData.get("auto_scan") === "on",
    welcome_message: welcome.length > 0 ? welcome : null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message ?? "Check the form." };
  }

  /*
   * `expires_at` is not touched here, and nothing on this form can move it.
   *
   * It used to be recomputed on every save, because the date of the event was
   * one of the fields and retention was counted from it. That made a save
   * which only changed a name a save that could rewrite the storage window -
   * and if `events.tier` held a product id the code could not resolve it read
   * as Free, which turned a paid 365-day window into 30 days. The guard
   * against that was the awkward part of this function; removing the date
   * removed the need for it. The window is settled by a purchase and by the
   * retention job, which are the only two things that know anything about it.
   */
  const { error } = await supabase
    .from("events")
    .update({
      name: parsed.data.name,
      gallery_visible: parsed.data.gallery_visible,
      require_approval: parsed.data.require_approval,
      auto_scan: parsed.data.auto_scan,
      welcome_message: parsed.data.welcome_message,
    })
    .eq("id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}
