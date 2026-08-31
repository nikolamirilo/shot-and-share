"use server";

import { requireOwnedEvent } from "@/lib/actions/guards";
import { ApiError } from "@/lib/api";
import { recoverPurchases } from "@/lib/payments/recover";
import { checkoutUrlForEvent } from "@/lib/payments/checkout";
import type { PurchasableId } from "@/lib/tiers";
import { revalidatePath } from "next/cache";

/**
 * Used by the upgrade buttons to reach the payment provider.
 *
 * Builds the checkout URL in-process. It used to POST to our own
 * `/api/checkout` over the public internet with the host's cookies forwarded,
 * which meant every upgrade depended on the app being able to reach itself
 * through its own edge - and when something in front answered instead, the
 * reply was an HTML page, `res.json()` threw, and the whole event page turned
 * into a 500 rather than a message under the button.
 *
 * Nothing is allowed to throw out of here for the same reason: an unhandled
 * throw in an action is a server render error, and "we could not start
 * checkout" belongs in the panel the host is looking at.
 */
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
    // An ApiError is the deliberate refusal - "payments are not configured" -
    // and says something the host can act on. Anything else is the provider
    // being unreachable or unhappy, and its text is not for a customer.
    if (error instanceof ApiError) return { error: error.message };

    console.error("[checkout] could not start checkout", error);
    return {
      error:
        "We could not reach the payment provider. Try again in a moment, and write to us if it keeps happening.",
    };
  }
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
