import "server-only";

import { type EventRow } from "@/types/db";
import { grantPurchase } from "@/lib/payments/grant";
import { listRecentOrders } from "@/lib/payments/creem";
import { createAdminClient } from "@/lib/supabase/admin";

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
      provider: "creem",
      // The same id the webhook would have used, so a late delivery is not applied
      // twice.
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
