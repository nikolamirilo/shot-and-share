"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwnedEvent } from "@/lib/actions/guards";
import { mediaExists } from "@/lib/db/media-repo";
import type { ActionState } from "@/lib/actions/types";
import { TIERS, getTier } from "@/lib/tiers";

const HEX = /^#[0-9a-fA-F]{6}$/;

const appearanceSchema = z.object({
  theme: z.string().trim().min(1).max(32),
  // Not an enum, for the same reason `theme` is not: pairings are defined in
  // the application and an unknown one falls back when it is read.
  theme_font: z.string().trim().min(1).max(32),
  cover_variant: z.enum(["full", "classic", "half", "type"]),
  upload_variant: z.enum(["button", "panel", "bar", "split"]),
  gallery_layout: z.enum(["grid", "masonry", "holes", "stack"]),
  cover_media_id: z.string().uuid().nullable(),
  custom_bg: z.string().regex(HEX).optional(),
  custom_surface: z.string().regex(HEX).optional(),
  custom_accent: z.string().regex(HEX).optional(),
  custom_ink: z.string().regex(HEX).optional(),
});

/**
 * The custom event page.
 *
 * Refused outright on the free plan. resolveAppearance() would render a free
 * event with the house theme regardless of what is stored, so this check is not
 * what protects the paywall - it is what gives the host a clear answer instead
 * of a form that appears to save and then changes nothing.
 */
export async function updateAppearance(
  eventId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, event } = await requireOwnedEvent(eventId);

  if (!getTier(event.tier).customPage) {
    return {
      error:
        `Custom event pages are on ${TIERS.plus.name} and ${TIERS.pro.name}. Your event still works exactly the same on the free plan.`,
    };
  }

  const coverMediaId = String(formData.get("cover_media_id") ?? "").trim();
  const parsed = appearanceSchema.safeParse({
    theme: formData.get("theme"),
    theme_font: formData.get("theme_font"),
    cover_variant: formData.get("cover_variant"),
    upload_variant: formData.get("upload_variant"),
    gallery_layout: formData.get("gallery_layout"),
    cover_media_id: coverMediaId.length > 0 ? coverMediaId : null,
    custom_bg: formData.get("custom_bg") ?? undefined,
    custom_surface: formData.get("custom_surface") ?? undefined,
    custom_accent: formData.get("custom_accent") ?? undefined,
    custom_ink: formData.get("custom_ink") ?? undefined,
  });
  if (!parsed.success) {
    return { error: "Those settings did not look right. Try again." };
  }

  // A cover photo has to belong to this event. Without this check a host could
  // point their cover at any media id they could guess.
  if (parsed.data.cover_media_id) {
    const owned = await mediaExists(supabase, {
      id: parsed.data.cover_media_id,
      eventId,
    });
    if (!owned) return { error: "That photo is not part of this event." };
  }

  const { error } = await supabase
    .from("events")
    .update({
      theme: parsed.data.theme,
      theme_font: parsed.data.theme_font,
      cover_variant: parsed.data.cover_variant,
      upload_variant: parsed.data.upload_variant,
      gallery_layout: parsed.data.gallery_layout,
      cover_media_id: parsed.data.cover_media_id,
      theme_custom: {
        bg: parsed.data.custom_bg,
        surface: parsed.data.custom_surface,
        accent: parsed.data.custom_accent,
        ink: parsed.data.custom_ink,
      },
    })
    .eq("id", eventId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}
