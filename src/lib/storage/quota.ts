import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every change to an event's used-bytes counter goes through here.
 *
 * Reserving and releasing were spelled out at eight call sites, each with its
 * own error handling, and a caller that forgot the release leaked a host's
 * quota until the nightly sweep noticed.
 */

/** Charge the event for bytes about to be uploaded. False means it is full. */
export async function reserve(eventId: string, bytes: number): Promise<boolean> {
  if (bytes <= 0) return true;
  const { data, error } = await createAdminClient().rpc("reserve_storage", {
    p_event: eventId,
    p_bytes: bytes,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * Hand bytes back. Best effort on purpose: a refund that fails must not mask
 * the error that caused it, so this logs rather than throwing.
 */
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

/**
 * A size that moved either way, which is the transcode case: a converted file
 * is usually smaller, sometimes larger. Returns false only when more room was
 * needed and there was none.
 */
export async function adjust(eventId: string, delta: number): Promise<boolean> {
  if (delta > 0) return reserve(eventId, delta);
  if (delta < 0) await release(eventId, -delta);
  return true;
}
