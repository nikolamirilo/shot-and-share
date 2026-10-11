"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireOwnedEvent, requireUser } from "@/lib/guards/host-action";
import type { ActionState } from "@/lib/actions/types";
import { LIMITS } from "@/constants/limits";
import { rateLimit } from "@/lib/ratelimit";
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
      require_approval: false,
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

  /**
   * `expires_at` is not touched here: recomputing it on every save reset the window a
   * purchase had moved.
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
