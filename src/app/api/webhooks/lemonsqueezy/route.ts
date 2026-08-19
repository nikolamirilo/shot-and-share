import { fail, handle, ok } from "@/lib/api";
import type { PurchaseStatus } from "@/lib/db/types";
import { env } from "@/lib/env";
import { grantPurchase, revokePurchase } from "@/lib/payments/grant";
import { parseWebhook, verifySignature } from "@/lib/payments/lemonsqueezy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The one event that moves an entitlement up. */
const GRANTING = new Set(["order_created"]);

/**
 * The ones that move it back down, and what each means for the purchase row.
 *
 * Only `order_refunded` can actually fire today: nothing recurring is sold. The
 * subscription cases are here because a provider that starts sending one should
 * find something listening rather than a silent 200, and because half of this
 * file survives a move to Paddle or Polar.
 */
const REVOKING: Record<string, Extract<PurchaseStatus, "refunded" | "expired" | "failed">> = {
  order_refunded: "refunded",
  subscription_expired: "expired",
  subscription_cancelled: "expired",
  subscription_payment_failed: "failed",
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
    if (!env.lemonSqueezy.webhookSecret) {
      return fail("not_configured", "No webhook secret configured.");
    }

    const raw = await request.text();
    const signature = request.headers.get("x-signature") ?? "";

    // Before the body is parsed, not after. Parsing attacker-controlled JSON is
    // a smaller risk than acting on it, but it is not no risk, and the check
    // costs one HMAC.
    if (!verifySignature(raw, signature)) {
      return fail("forbidden", "Bad signature.");
    }

    const parsed = parseWebhook(JSON.parse(raw));
    if (!parsed) return ok({ ignored: "unparseable" });

    const revokeAs = REVOKING[parsed.eventName];
    if (revokeAs) {
      const result = await revokePurchase({
        provider: "lemonsqueezy",
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
      provider: "lemonsqueezy",
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
