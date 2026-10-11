"use server";

import { requireOwnedEvent, requireUser } from "@/lib/guards/host-action";
import { billingPortalUrl } from "@/lib/payments/creem";
import { ApiError } from "@/lib/api";
import { recoverPurchases } from "@/lib/payments/recover";
import { checkoutUrlForEvent } from "@/lib/payments/checkout";
import type { PurchasableId } from "@/lib/tiers";
import { revalidatePath } from "next/cache";

export async function startCheckout(
  eventId: string,
  product: PurchasableId,
): Promise<{ url?: string; error?: string }> {
  const { event, user } = await requireOwnedEvent(eventId);

  try {
    return {
      url: await checkoutUrlForEvent({
        product,
        eventId: event.id,
        ownerId: user.id,
        email: user.email,
      }),
    };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };

    console.error("[checkout] could not start checkout", error);
    return {
      error:
        "We could not reach the payment provider. Try again in a moment, and write to us if it keeps happening.",
    };
  }
}

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

export async function openBillingPortal(): Promise<{
  url?: string;
  error?: string;
}> {
  const { user } = await requireUser();

  if (!user.email) {
    return {
      error: "This account has no email address on it, so we cannot find your billing.",
    };
  }

  try {
    const url = await billingPortalUrl(user.email);
    if (!url) {
      return {
        error:
          "We could not find any billing for this account. If you have paid for something, write to us and we will sort it by hand.",
      };
    }
    return { url };
  } catch (error) {
    console.error("[portal] failed", error);
    return {
      error:
        "We could not reach the payment provider. Try again in a moment, and write to us if it keeps happening.",
    };
  }
}
