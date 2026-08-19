import "server-only";

import type { EventRow } from "@/lib/db/types";
import { grantPurchase } from "@/lib/payments/grant";
import { listRecentOrders } from "@/lib/payments/lemonsqueezy";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The buyer's way out of a webhook that never arrived.
 *
 * Every path into this product grants entitlement from the provider's signed
 * webhook and nothing else, which is correct and occasionally leaves somebody
 * who has paid staring at a plan that did not change. This asks the provider
 * directly for orders under the host's own email address, and applies any that
 * were never recorded.
 *
 * Two things keep it honest, and both matter more than they look:
 *
 *   * It never invents a purchase. An order has to exist in the provider's
 *     records, paid, under the email on the account.
 *   * It only applies orders that are recorded against nothing. An order that
 *     already unlocked another event is somebody's previous purchase, and
 *     moving it here would take that event's plan away.
 *
 * The second rule means recovery cannot move an entitlement between two events
 * the same person owns. That is deliberate. Somebody who bought for the wrong
 * event needs a human, not a button that silently rearranges what they paid for.
 */
export async function recoverPurchases(
  event: EventRow,
  email: string | null | undefined,
): Promise<{ applied: number; found: number }> {
  if (!email) return { applied: 0, found: 0 };

  const orders = await listRecentOrders(email);
  const usable = orders.filter(
    (order) => order.product !== null && order.status === "paid",
  );
  if (usable.length === 0) return { applied: 0, found: 0 };

  const admin = createAdminClient();

  // One query rather than one per order. A host who has bought a dozen things
  // should not cost a dozen round trips to be told nothing is missing.
  const { data: known } = await admin
    .from("purchases")
    .select("order_id, provider_txn_id")
    .in("order_id", usable.map((order) => order.id));

  const recorded = new Set<string>();
  for (const row of known ?? []) {
    if (row.order_id) recorded.add(row.order_id);
    if (row.provider_txn_id) recorded.add(row.provider_txn_id);
  }

  const missing = usable.filter((order) => !recorded.has(order.id));

  let applied = 0;
  for (const order of missing) {
    const result = await grantPurchase({
      eventId: event.id,
      product: order.product!,
      provider: "lemonsqueezy",
      // The same id the webhook would have used, so if it turns up late the
      // unique constraint recognises it and nothing is applied twice.
      providerTxnId: order.id,
      orderId: order.id,
      amountCents: order.amountCents,
      currency: order.currency,
      raw: { recovered: true, order },
    });
    if (result.applied) applied += 1;
  }

  if (applied > 0) {
    console.warn("[recovery] applied an order the webhook never delivered", {
      eventId: event.id,
      orders: missing.map((order) => order.id),
    });
  }

  return { applied, found: missing.length };
}
