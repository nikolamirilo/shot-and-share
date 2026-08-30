import { fail, handle, ok } from "@/lib/api";
import type { PurchaseStatus } from "@/lib/db/types";
import { env } from "@/lib/env";
import { grantPurchase, revokePurchase } from "@/lib/payments/grant";
import { parseWebhook, verifySignature } from "@/lib/payments/creem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The one event that moves an entitlement up. */
const GRANTING = new Set(["checkout.completed"]);

/**
 * The ones that move it back down, and what each means for the purchase row.
 *
 * `refund.created` and `dispute.created` are the two that can fire today:
 * nothing recurring is sold. A dispute is treated as money gone rather than
 * money contested, because with a merchant of record the funds are pulled
 * immediately and the refund policy already says we will not contest a refund
 * we would have given anyway - so leaving the plan unlocked would be product
 * delivered for nothing.
 *
 * The subscription cases are here because a provider that starts sending one
 * should find something listening rather than a silent 200. Two are absent on
 * purpose, and both would be bugs if they were here:
 *
 *   * `subscription.past_due` is a dunning window, not a verdict. Creem retries
 *     the card and the subscription goes back to active if one succeeds, so
 *     revoking here takes a plan away from somebody who then keeps paying for
 *     it. `subscription.unpaid` is what that window ending looks like.
 *   * `subscription.scheduled_cancel` is reversible until the period ends, and
 *     the customer has paid for the period either way. `subscription.expired`
 *     is what the period actually ending looks like.
 */
const REVOKING: Record<
  string,
  Extract<PurchaseStatus, "refunded" | "expired" | "failed">
> = {
  "refund.created": "refunded",
  "dispute.created": "refunded",
  "subscription.expired": "expired",
  "subscription.canceled": "expired",
  "subscription.paused": "expired",
  "subscription.unpaid": "failed",
};

/**
 * The only place a tier moves.
 *
 * Four things matter here and they are all load-bearing:
 *
 *   * the signature is checked against the raw body before anything is parsed,
 *   * the handler is idempotent, because webhooks are delivered more than once,
 *   * an unrecognised event is acknowledged rather than retried forever,
 *   * and a genuine failure returns 500 so the provider retries rather than
 *     marking a paying customer as handled.
 */
export async function POST(request: Request) {
  return handle(async () => {
    if (!env.creem.webhookSecret) {
      return fail("not_configured", "No webhook secret configured.");
    }

    // The raw text, never a re-serialised object: the signature is over the
    // exact bytes Creem sent, and any parse-then-stringify round trip is free to
    // reorder keys or renormalise numbers.
    const raw = await request.text();

    // Before the body is parsed, not after. Parsing attacker-controlled JSON is
    // a smaller risk than acting on it, but it is not no risk, and the check
    // costs one HMAC. The headers go in whole rather than one named header,
    // because Creem signs two different ways - see `verifySignature`.
    if (!verifySignature(raw, request.headers)) {
      return fail("forbidden", "Bad signature.");
    }

    const parsed = parseWebhook(JSON.parse(raw));
    if (!parsed) return ok({ ignored: "unparseable" });

    const revokeAs = REVOKING[parsed.eventName];
    if (revokeAs) {
      const result = await revokePurchase({
        provider: "creem",
        orderId: parsed.orderId,
        subscriptionId: parsed.subscriptionId,
        status: revokeAs,
      });
      if (!result.applied) {
        console.warn("[webhook] nothing to revoke", parsed.eventName, {
          orderId: parsed.orderId,
          subscriptionId: parsed.subscriptionId,
          reason: result.reason,
        });
      }
      return ok(result);
    }

    if (!GRANTING.has(parsed.eventName)) {
      return ok({ ignored: parsed.eventName });
    }

    if (!parsed.eventId || !parsed.product) {
      console.warn(
        "[webhook] paid order with no event to apply it to",
        parsed.txnId,
      );
      return ok({ ignored: "no_target" });
    }

    const result = await grantPurchase({
      eventId: parsed.eventId,
      product: parsed.product,
      provider: "creem",
      providerTxnId: parsed.txnId,
      orderId: parsed.orderId,
      subscriptionId: parsed.subscriptionId,
      amountCents: parsed.amountCents,
      currency: parsed.currency,
      raw: JSON.parse(raw),
    });

    return ok(result);
  });
}
