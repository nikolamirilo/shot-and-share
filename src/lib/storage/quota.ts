import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function reserve(eventId: string, bytes: number): Promise<boolean> {
  if (bytes <= 0) return true;
  const { data, error } = await createAdminClient().rpc("reserve_storage", {
    p_event: eventId,
    p_bytes: bytes,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function release(eventId: string, bytes: number): Promise<void> {
  if (bytes <= 0) return;
  try {
    const { error } = await createAdminClient().rpc("release_storage", {
      p_event: eventId,
      p_bytes: bytes,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[quota] could not release bytes", { eventId, bytes, error });
  }
}

export async function adjust(eventId: string, delta: number): Promise<boolean> {
  if (delta > 0) return reserve(eventId, delta);
  if (delta < 0) await release(eventId, -delta);
  return true;
}
