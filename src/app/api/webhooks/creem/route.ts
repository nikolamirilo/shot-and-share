import { fail, handle, ok } from "@/lib/api";
import type { PurchaseStatus } from "@/lib/db/types";
import { env } from "@/lib/env";
import {
  eventForSubscription,
  grantPurchase,
  revokePurchase,
} from "@/lib/payments/grant";
import { parseWebhook, verifySignature } from "@/lib/payments/creem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The events that move an entitlement up.
 *
 * `checkout.completed` is a plan being bought, or the first payment of a
 * keeping subscription. `subscription.paid` is every renewal after that, and it
 * has to grant too: a year of keeping is one purchase row, so a renewal that
 * was merely acknowledged would leave the window where last year's payment put
 * it and the photos would come down on somebody who is still paying.
 *
 * Both are idempotent through the unique constraint on `provider_txn_id`, and
 * each year's payment is its own delivery with its own id - which is exactly
 * what makes counting the rows the right way to measure the window.
 */
const GRANTING = new Set(["checkout.completed", "subscription.paid"]);

/**
 * The ones that move it back down, and what each means for the purchase row.
 *
 * Only money actually coming back. A dispute is treated as money gone rather
 * than money contested, because with a merchant of record the funds are pulled
 * immediately and the refund policy already says we will not contest a refund
 * we would have given anyway - so leaving the plan unlocked would be product
 * delivered for nothing.
 *
 * **No `subscription.*` event is here, and that is the change that matters.**
 * They used to be, as guards written when nothing recurring was sold. Now that
 * keeping is a yearly subscription they would be a bug with teeth: a keeping
 * payment is one purchase row worth one year, and revoking on a cancellation
 * would take back years somebody had already paid for and bring their photos
 * down early.
 *
 * What should happen when a subscription ends is that the window stops being
 * extended - and that needs no code at all, because the window is counted from
 * the payments that exist rather than stored. No renewal means no new row means
 * no extra year, and the event falls back to the retention its plan always had.
 * The absence is the implementation.
 *
 * So the whole family is acknowledged and ignored:
 *
 *   * `subscription.canceled`, `subscription.expired`, `subscription.paused` -
 *     the customer stops paying forward. Everything already paid for stands.
 *   * `subscription.past_due`, `subscription.unpaid` - a failed renewal. The
 *     years already bought are untouched; the host simply does not get another.
 *   * `subscription.scheduled_cancel` - reversible, and paid for either way.
 *
 * A refund of a specific keeping payment still works, and still takes exactly
 * one year back off, because that arrives as `refund.created` against the order
 * it was taken under.
 */
const REVOKING: Record<
  string,
  Extract<PurchaseStatus, "refunded" | "expired" | "failed">
> = {
  "refund.created": "refunded",
  "dispute.created": "refunded",
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

    /*
     * A renewal does not necessarily carry the metadata the original checkout
     * did, so the event is looked up from the subscription that is paying for
     * it. The first payment wrote a row with both, which is what makes this
     * resolvable at all.
     */
    const eventId =
      parsed.eventId ?? (await eventForSubscription(parsed.subscriptionId));

    if (!eventId || !parsed.product) {
      console.warn(
        "[webhook] paid order with no event to apply it to",
        parsed.txnId,
        { subscriptionId: parsed.subscriptionId },
      );
      return ok({ ignored: "no_target" });
    }

    const result = await grantPurchase({
      eventId,
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
