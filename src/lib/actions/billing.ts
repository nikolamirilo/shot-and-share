"use server";

import { headers } from "next/headers";

import { requireOwnedEvent } from "@/lib/actions/guards";
import { recoverPurchases } from "@/lib/payments/recover";
import { env } from "@/lib/env";
import type { PurchasableId } from "@/lib/tiers";
import { clientIp } from "@/lib/ratelimit";
import { revalidatePath } from "next/cache";

/** Used by the upgrade buttons to reach the payment provider. */
export async function startCheckout(
  eventId: string,
  product: PurchasableId,
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

/**
 * "I paid and nothing happened."
 *
 * The button behind that sentence. It asks the payment provider whether an
 * order exists under this host's email that we never recorded, and applies it
 * through exactly the same code path the webhook uses.
 *
 * Told plainly either way. A host who has paid and sees "nothing to recover"
 * needs to know to write to us, not to press it again.
 */
export async function recoverPurchase(
  eventId: string,
): Promise<{ ok?: boolean; error?: string; applied?: number }> {
  const { event, user } = await requireOwnedEvent(eventId);

  try {
    const { applied } = await recoverPurchases(event, user.email);
    if (applied > 0) revalidatePath(`/dashboard/events/${eventId}`);
    return { ok: true, applied };
  } catch (error) {
    console.error("[recovery] failed", error);
    return {
      error:
        "We could not reach the payment provider. Write to us and we will sort it by hand.",
    };
  }
}
