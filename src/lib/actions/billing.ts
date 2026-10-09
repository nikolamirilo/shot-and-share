"use server";

import { requireOwnedEvent, requireUser } from "@/lib/actions/guards";
import { billingPortalUrl } from "@/lib/payments/creem";
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

/**
 * "Where do I cancel?"
 *
 * Opens Creem's billing portal for the signed-in host, where they can see the
 * renewal date, change the card, read invoices and cancel the keeping
 * subscription. Creem holds all of that; mirroring any of it here to render a
 * page would be a second source of truth about somebody's money.
 *
 * Takes no event id on purpose. A Creem customer is the host, not the event, so
 * one portal covers every event they have ever paid for - which is also the
 * right shape for the question, because a host wanting to cancel does not think
 * in events.
 *
 * Nothing throws out of here, same as `startCheckout`: an unhandled throw in an
 * action is a server render error, and "we could not reach the provider" belongs
 * under the button.
 */
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
