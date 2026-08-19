import "server-only";

import type {
  EventRow,
  Product,
  PurchaseRow,
  PurchaseStatus,
} from "@/lib/db/types";
import { KEEP_FOREVER, TIERS, computeExpiry, getTier } from "@/lib/tiers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Entitlement, in one direction and the other.
 *
 * A webhook is the only thing that grants access, and the application never
 * trusts a client-side success redirect for it. Recovery exists for the case
 * where the webhook never arrives, but it asks the provider rather than
 * believing the browser.
 *
 * Everything here works the same way: write down what was paid, then recompute
 * what the event is entitled to from the purchases that are still standing.
 * Nothing nudges a tier up or down directly, which is what makes a refund
 * followed by a re-purchase land somewhere sane instead of somewhere arithmetic.
 */

export interface GrantArgs {
  eventId: string;
  product: Product;
  provider: string;
  providerTxnId: string;
  orderId?: string | null;
  subscriptionId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  raw?: unknown;
}

export async function grantPurchase(
  args: GrantArgs,
): Promise<{ applied: boolean; reason?: string }> {
  const admin = createAdminClient();

  const { data: event } = await admin
    .from("events")
    .select("*")
    .eq("id", args.eventId)
    .maybeSingle();

  if (!event) return { applied: false, reason: "unknown_event" };
  const current = event as EventRow;

  const { error: insertError } = await admin.from("purchases").insert({
    event_id: current.id,
    owner_id: current.owner_id,
    provider: args.provider,
    provider_txn_id: args.providerTxnId,
    order_id: args.orderId ?? null,
    subscription_id: args.subscriptionId ?? null,
    product: args.product,
    amount_cents: args.amountCents ?? null,
    currency: args.currency ?? null,
    status: "paid",
    raw: args.raw ?? null,
  });

  if (insertError) {
    // 23505 is unique_violation: this webhook has already been processed. The
    // constraint does the idempotency, not a read-then-write, because two
    // deliveries of the same webhook arrive concurrently often enough to matter.
    if (insertError.code === "23505") {
      return { applied: false, reason: "duplicate" };
    }
    throw insertError;
  }

  await recomputeEntitlement(current.id);
  return { applied: true };
}

/**
 * Take an entitlement back down.
 *
 * Called for `order_refunded`, `subscription_expired` and
 * `subscription_payment_failed`. Nothing recurring is sold today, so the last
 * two are guards rather than features - but a provider that decides to send one
 * should not find nothing listening.
 *
 * Matched on the order, not the transaction id: a refund is its own delivery
 * with its own id, and the only thing tying it to what was bought is the order
 * the money was taken under.
 */
export async function revokePurchase(args: {
  provider: string;
  orderId?: string | null;
  subscriptionId?: string | null;
  status: Extract<PurchaseStatus, "refunded" | "expired" | "failed">;
}): Promise<{ applied: boolean; reason?: string; events?: number }> {
  if (!args.orderId && !args.subscriptionId) {
    return { applied: false, reason: "nothing_to_match" };
  }

  const admin = createAdminClient();

  /*
   * The predicate is written once and used twice: to learn which events are
   * affected, and to do the update. Selecting ids and then updating by id would
   * be a second way of saying the same thing, and it would quietly do nothing
   * against any row whose id the select did not return.
   */
  const matching = <T extends { eq(column: string, value: unknown): T }>(
    builder: T,
  ): T => {
    const scoped = builder.eq("provider", args.provider).eq("status", "paid");
    return args.orderId
      ? scoped.eq("order_id", args.orderId)
      : scoped.eq("subscription_id", args.subscriptionId!);
  };

  const { data, error } = await matching(
    admin.from("purchases").select("*"),
  );
  if (error) throw error;

  const rows = (data ?? []) as PurchaseRow[];

  /*
   * Nothing to revoke is a normal outcome, not a failure. A refund on an order
   * this deployment never recorded - a test store, a purchase made before the
   * order id was stored, a replay of something already handled - has to be
   * acknowledged, or the provider retries it forever.
   */
  if (rows.length === 0) return { applied: false, reason: "no_match" };

  const { error: updateError } = await matching(
    admin.from("purchases").update({ status: args.status }),
  );
  if (updateError) throw updateError;

  // One order can only touch one event in this product, but the loop costs
  // nothing and a purchase row with no event is a real state - see the
  // `on delete set null` in migration 0001.
  const eventIds = [
    ...new Set(rows.map((row) => row.event_id).filter((id): id is string => Boolean(id))),
  ];
  for (const eventId of eventIds) {
    await recomputeEntitlement(eventId);
  }

  return { applied: true, events: eventIds.length };
}

/**
 * What this event is entitled to, worked out from scratch.
 *
 * The rule is the highest paid tier still standing, plus Keep Forever if any
 * unrefunded purchase of it remains. Deriving it beats adjusting it: a refund
 * of Pro on an event that also bought Plus has to land on Plus, and no amount
 * of "step the tier down one" produces that.
 *
 * A downgrade never deletes anything. It lowers the quota and puts an expiry
 * back, and the retention job's warnings run before any file is touched, which
 * is what the refund policy promises.
 */
export async function recomputeEntitlement(
  eventId: string,
): Promise<{ tier: string; keepForever: boolean } | null> {
  const admin = createAdminClient();

  const [{ data: eventRow }, { data: purchaseRows }] = await Promise.all([
    admin.from("events").select("*").eq("id", eventId).maybeSingle(),
    admin
      .from("purchases")
      .select("*")
      .eq("event_id", eventId)
      .eq("status", "paid"),
  ]);

  if (!eventRow) return null;
  const event = eventRow as EventRow;
  const paid = (purchaseRows ?? []) as PurchaseRow[];

  const keepForever = paid.some((row) => row.product === KEEP_FOREVER.key);

  const tier = paid
    .filter((row) => row.product !== KEEP_FOREVER.key)
    .map((row) => TIERS[row.product as keyof typeof TIERS])
    .filter(Boolean)
    .reduce((best, candidate) => (candidate.rank > best.rank ? candidate : best), TIERS.free);

  const expiresAt = keepForever
    ? null
    : computeExpiry(event.event_date, tier).toISOString();

  /*
   * An expired or soft-deleted event that has just been paid for comes back.
   * One that has just been refunded is not pushed into expiry here - it gets
   * its window recalculated and the retention job decides, with its warnings,
   * whether that window has already passed.
   */
  const reactivate = tier.rank > getTier(event.tier).rank || keepForever;

  const { error } = await admin
    .from("events")
    .update({
      tier: tier.id,
      keep_forever: keepForever,
      storage_quota_bytes: tier.quotaBytes,
      expires_at: expiresAt,
      status:
        reactivate && event.status === "expired" ? "active" : event.status,
      deleted_at: reactivate ? null : event.deleted_at,
      warned_at_days: null,
    })
    .eq("id", eventId);

  if (error) throw error;
  return { tier: tier.id, keepForever };
}
