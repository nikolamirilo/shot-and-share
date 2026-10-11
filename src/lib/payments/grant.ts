import "server-only";

import { type EventRow, type Product, type PurchaseRow, type PurchaseStatus } from "@/types/db";
import {
  KEEPING_DAYS,
  TIERS,
  computeExpiry,
  getTier,
  isKeepingProduct,
} from "@/lib/tiers";
import { createAdminClient } from "@/lib/supabase/admin";

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
    // constraint does the idempotency, because duplicate deliveries race.
    if (insertError.code === "23505") {
      return { applied: false, reason: "duplicate" };
    }
    throw insertError;
  }

  await recomputeEntitlement(current.id);
  return { applied: true };
}

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

  if (rows.length === 0) return { applied: false, reason: "no_match" };

  const { error: updateError } = await matching(
    admin.from("purchases").update({ status: args.status }),
  );
  if (updateError) throw updateError;

  const eventIds = [
    ...new Set(rows.map((row) => row.event_id).filter((id): id is string => Boolean(id))),
  ];
  for (const eventId of eventIds) {
    await recomputeEntitlement(eventId);
  }

  return { applied: true, events: eventIds.length };
}

export async function recomputeEntitlement(
  eventId: string,
): Promise<{ tier: string; keepForever: boolean; keptYears: number } | null> {
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

  const keepForever = paid.some((row) => row.product === "keep_forever");

  const plans = paid.filter((row) => row.product in TIERS);
  const tier = plans
    .map((row) => TIERS[row.product as keyof typeof TIERS])
    .filter(Boolean)
    .reduce((best, candidate) => (candidate.rank > best.rank ? candidate : best), TIERS.free);

  const keptYears = paid.filter((row) => isKeepingProduct(row.product)).length;

  const paidAt = plans
    .filter((row) => row.product === tier.key)
    .map((row) => row.created_at)
    .sort()
    .at(-1);
  const anchor = latest(event.retention_from, paidAt);

  const expiresAt = keepForever
    ? null
    : addDays(
        computeExpiry(anchor, tier),
        keptYears * KEEPING_DAYS,
      ).toISOString();

  const reactivate =
    tier.rank > getTier(event.tier).rank || keepForever || keptYears > 0;

  const { error } = await admin
    .from("events")
    .update({
      tier: tier.id,
      keep_forever: keepForever,
      storage_quota_bytes: tier.quotaBytes,
      // `retention_from` is deliberately not written back: deriving the anchor every
      // time is what lets a refund of Pro fall back to the day Plus was paid for.
      expires_at: expiresAt,
      status:
        reactivate && event.status === "expired" ? "active" : event.status,
      deleted_at: reactivate ? null : event.deleted_at,
      warned_at_days: null,
    })
    .eq("id", eventId);

  if (error) throw error;
  return { tier: tier.id, keepForever, keptYears };
}

function latest(a: string, b?: string): string {
  return b && Date.parse(b) > Date.parse(a) ? b : a;
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function countKeepingYears(eventId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("purchases")
    .select("product")
    .eq("event_id", eventId)
    .eq("status", "paid");

  return (data ?? []).filter((row) => isKeepingProduct(row.product)).length;
}

export async function eventForSubscription(
  subscriptionId: string | null | undefined,
): Promise<string | null> {
  if (!subscriptionId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("purchases")
    .select("event_id")
    .eq("subscription_id", subscriptionId)
    .not("event_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as { event_id: string } | null)?.event_id ?? null;
}
