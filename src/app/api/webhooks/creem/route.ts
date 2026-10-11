import { fail, handle, ok } from "@/lib/api";
import { type PurchaseStatus } from "@/types/db";
import { env } from "@/lib/env";
import {
  eventForSubscription,
  grantPurchase,
  revokePurchase,
} from "@/lib/payments/grant";
import { parseWebhook, verifySignature } from "@/lib/payments/creem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRANTING = new Set(["checkout.completed", "subscription.paid"]);

const REVOKING: Record<
  string,
  Extract<PurchaseStatus, "refunded" | "expired" | "failed">
> = {
  "refund.created": "refunded",
  "dispute.created": "refunded",
};

export async function POST(request: Request) {
  return handle(async () => {
    if (!env.creem.webhookSecret) {
      return fail("not_configured", "No webhook secret configured.");
    }

    // The raw text, never a re-serialised object: the signature is over Creem's exact
    // bytes.
    const raw = await request.text();

    // Before the body is parsed. Headers go in whole because Creem signs two ways.
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
