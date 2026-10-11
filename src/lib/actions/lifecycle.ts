"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnedEvent } from "@/lib/guards/host-action";
import { purgePrefix } from "@/lib/cdn/purge";
import type { ActionState } from "@/lib/actions/types";
import { archiveKey, eventPrefix, scopeOfEvent } from "@/lib/media";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTier } from "@/lib/tiers";

export async function deleteEvent(eventId: string): Promise<ActionState> {
  const { event } = await requireOwnedEvent(eventId);
  const admin = createAdminClient();

  const prefix = eventPrefix(scopeOfEvent(event));
  await storage.removePrefix(prefix);
  // One wildcard rather than three paths per photograph: CloudFront meters paths.
  await purgePrefix(prefix);
  const { error } = await admin.from("events").delete().eq("id", event.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function restoreEvent(eventId: string): Promise<ActionState> {
  const { event } = await requireOwnedEvent(eventId);
  if (event.status !== "expired") return { ok: true };

  const admin = createAdminClient();
  const tier = getTier(event.tier);
  const { error } = await admin
    .from("events")
    .update({
      status: "active",
      deleted_at: null,
      warned_at_days: null,
      expires_at: new Date(
        Date.now() + Math.min(30, tier.retentionDays) * 86_400_000,
      ).toISOString(),
    })
    .eq("id", eventId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/events/${eventId}`);
  return { ok: true };
}

export async function invalidateArchive(eventId: string): Promise<ActionState> {
  const { event } = await requireOwnedEvent(eventId);
  const admin = createAdminClient();

  await storage.remove([archiveKey(scopeOfEvent(event))]);
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
