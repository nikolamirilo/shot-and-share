import { fail, handle, ok } from "@/lib/api";
import { env } from "@/lib/env";
import { grantPurchase } from "@/lib/payments/grant";
import { parseWebhook, verifySignature } from "@/lib/payments/lemonsqueezy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only these move an entitlement. Everything else is acknowledged and ignored. */
const GRANTING_EVENTS = new Set(["order_created"]);

/**
 * The one place a tier can go up.
 *
 * Three things matter here and they are all load-bearing: the signature is
 * checked against the raw body before anything is parsed, the handler is
 * idempotent on the provider transaction id because webhooks are delivered more
 * than once, and a failure returns 500 so the provider retries rather than
 * marking a paid customer as handled.
 */
export async function POST(request: Request) {
  return handle(async () => {
    if (!env.lemonSqueezy.webhookSecret) {
      return fail("not_configured", "No webhook secret configured.");
    }

    const raw = await request.text();
    const signature = request.headers.get("x-signature") ?? "";

    if (!verifySignature(raw, signature)) {
      return fail("forbidden", "Bad signature.");
    }

    const parsed = parseWebhook(JSON.parse(raw));
    if (!parsed) return ok({ ignored: "unparseable" });

    if (!GRANTING_EVENTS.has(parsed.eventName)) {
      return ok({ ignored: parsed.eventName });
    }
    if (!parsed.eventId || !parsed.product) {
      console.warn("[webhook] paid order with no event to apply it to", parsed.txnId);
      return ok({ ignored: "no_target" });
    }

    const result = await grantPurchase({
      eventId: parsed.eventId,
      product: parsed.product,
      provider: "lemonsqueezy",
      providerTxnId: parsed.txnId,
      amountCents: parsed.amountCents,
      currency: parsed.currency,
      raw: JSON.parse(raw),
    });

    return ok(result);
  });
}
