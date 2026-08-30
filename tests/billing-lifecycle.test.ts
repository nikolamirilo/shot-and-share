import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";

/**
 * Entitlement in both directions.
 *
 * The upgrade path had tests. The downgrade path had no code, which is the
 * expensive half: a refund that leaves the plan unlocked is money out and
 * product still delivered, and it is the first thing a payment reviewer looks
 * for when they are trying to predict chargebacks.
 */

const store = createStore();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

vi.mock("@/lib/tiers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tiers")>(
    "@/lib/tiers",
  );
  return actual;
});

const { grantPurchase, revokePurchase } = await import("@/lib/payments/grant");
const { TIERS } = await import("@/lib/tiers");

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const OWNER_ID = "00000000-1111-2222-3333-444444444444";

function seedEvent(over: Record<string, unknown> = {}) {
  store.rows("events").push({
    id: EVENT_ID,
    owner_id: OWNER_ID,
    name: "A wedding",
    event_date: "2026-09-01",
    tier: TIERS.free.id,
    keep_forever: false,
    storage_quota_bytes: TIERS.free.quotaBytes,
    storage_used_bytes: 0,
    expires_at: null,
    status: "active",
    deleted_at: null,
    warned_at_days: null,
    ...over,
  });
}

const event = () => store.rows("events")[0];

beforeEach(() => {
  store.reset();
  seedEvent();
});

describe("granting", () => {
  /*
   * Buying the cheaper plan after the dearer one is a real thing people do -
   * usually Keep Forever, occasionally a mistake. The entitlement is derived
   * from every standing purchase, so the lower one cannot pull the event down.
   */
  it("does not move the event backwards when a lesser plan is bought after", async () => {
    await grantPurchase({
      eventId: EVENT_ID,
      product: "pro",
      provider: "creem",
      providerTxnId: "order-1",
      orderId: "order-1",
    });
    await grantPurchase({
      eventId: EVENT_ID,
      product: "plus",
      provider: "creem",
      providerTxnId: "order-2",
      orderId: "order-2",
    });

    expect(event().tier).toBe(TIERS.pro.id);
  });

  it("ignores a webhook it has already handled", async () => {
    store.failInsert("purchases", undefined);
    await grantPurchase({
      eventId: EVENT_ID,
      product: "plus",
      provider: "creem",
      providerTxnId: "order-1",
      orderId: "order-1",
    });

    store.failInsert("purchases", { code: "23505", message: "duplicate key" });
    const again = await grantPurchase({
      eventId: EVENT_ID,
      product: "pro",
      provider: "creem",
      providerTxnId: "order-1",
      orderId: "order-1",
    });

    expect(again).toEqual({ applied: false, reason: "duplicate" });
    expect(event().tier).toBe(TIERS.plus.id);
  });
});

describe("revoking", () => {
  beforeEach(() => {
    store.failInsert("purchases", undefined);
  });

  /*
   * The case a "step the tier down one" implementation gets wrong. Refunding
   * Pro on an event that also paid for Plus has to land on Plus, and the only
   * way to be sure is to recompute from what is left rather than to subtract.
   */
  it("lands on the plan still paid for, not on free", async () => {
    await grantPurchase({
      eventId: EVENT_ID,
      product: "plus",
      provider: "creem",
      providerTxnId: "order-1",
      orderId: "order-1",
    });
    await grantPurchase({
      eventId: EVENT_ID,
      product: "pro",
      provider: "creem",
      providerTxnId: "order-2",
      orderId: "order-2",
    });

    await revokePurchase({
      provider: "creem",
      orderId: "order-2",
      status: "refunded",
    });

    expect(event().tier).toBe(TIERS.plus.id);
  });

  it("puts the storage window back when Keep Forever is refunded", async () => {
    await grantPurchase({
      eventId: EVENT_ID,
      product: "keep_forever",
      provider: "creem",
      providerTxnId: "order-1",
      orderId: "order-1",
    });
    expect(event().keep_forever).toBe(true);
    expect(event().expires_at).toBeNull();

    await revokePurchase({
      provider: "creem",
      orderId: "order-1",
      status: "refunded",
    });

    expect(event().keep_forever).toBe(false);
    // A window again, rather than a deletion. The retention job's warnings run
    // before anything is touched, which is what the refund policy promises.
    expect(event().expires_at).not.toBeNull();
  });

  it("acknowledges a refund for an order it never recorded", async () => {
    const result = await revokePurchase({
      provider: "creem",
      orderId: "order-nobody-has-heard-of",
      status: "refunded",
    });

    // Not a throw. A 500 here means the provider retries this forever.
    expect(result).toEqual({ applied: false, reason: "no_match" });
  });

  it("handles a subscription expiring even though nothing recurring is sold", async () => {
    await grantPurchase({
      eventId: EVENT_ID,
      product: "pro",
      provider: "creem",
      providerTxnId: "txn-1",
      orderId: "order-1",
      subscriptionId: "sub-1",
    });

    await revokePurchase({
      provider: "creem",
      subscriptionId: "sub-1",
      status: "expired",
    });

    expect(event().tier).toBe(TIERS.free.id);
    expect(store.rows("purchases")[0].status).toBe("expired");
  });

  it("refuses to act when it has been given nothing to match on", async () => {
    const result = await revokePurchase({
      provider: "creem",
      status: "refunded",
    });
    expect(result).toEqual({ applied: false, reason: "nothing_to_match" });
  });
});

describe("recomputing", () => {
  it("brings an expired event back when a plan is still paid for", async () => {
    store.reset();
    seedEvent({ status: "expired", deleted_at: "2026-08-01T00:00:00.000Z" });

    await grantPurchase({
      eventId: EVENT_ID,
      product: "pro",
      provider: "creem",
      providerTxnId: "order-1",
      orderId: "order-1",
    });

    expect(event().status).toBe("active");
    expect(event().deleted_at).toBeNull();
  });
});
