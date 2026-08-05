import "server-only";

import type { EventRow, Product } from "@/lib/db/types";
import { KEEP_FOREVER, TIERS, computeExpiry, isUpgrade } from "@/lib/tiers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A webhook is the only thing that grants access. The application never trusts
 * a client-side success redirect for entitlement.
 *
 * Idempotent on the provider transaction id, because webhooks are delivered
 * more than once - the unique constraint does the work, not a read-then-write.
 */
export async function grantPurchase(args: {
  eventId: string;
  product: Product;
  provider: string;
  providerTxnId: string;
  amountCents?: number | null;
  currency?: string | null;
  raw?: unknown;
}): Promise<{ applied: boolean; reason?: string }> {
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
    product: args.product,
    amount_cents: args.amountCents ?? null,
    currency: args.currency ?? null,
    status: "paid",
    raw: args.raw ?? null,
  });

  if (insertError) {
    // 23505 is unique_violation: this webhook has already been processed.
    if (insertError.code === "23505") {
      return { applied: false, reason: "duplicate" };
    }
    throw insertError;
  }

  if (args.product === KEEP_FOREVER.id) {
    await admin
      .from("events")
      .update({
        keep_forever: true,
        expires_at: null,
        status: current.status === "expired" ? "active" : current.status,
        deleted_at: null,
        warned_at_days: null,
      })
      .eq("id", current.id);
    return { applied: true };
  }

  const target = args.product;
  if (!isUpgrade(current.tier, target)) {
    // Paid for something at or below what they already have. The purchase row
    // is still recorded; the entitlement simply does not move backwards.
    return { applied: true, reason: "no_downgrade" };
  }

  await admin
    .from("events")
    .update({
      tier: target,
      storage_quota_bytes: TIERS[target].quotaBytes,
      expires_at: current.keep_forever
        ? null
        : computeExpiry(current.event_date, target).toISOString(),
      status: current.status === "expired" ? "active" : current.status,
      deleted_at: null,
      warned_at_days: null,
    })
    .eq("id", current.id);

  return { applied: true };
}
