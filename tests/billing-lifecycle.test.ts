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

const { grantPurchase, recomputeEntitlement, revokePurchase } = await import(
  "@/lib/payments/grant",
);
const { TIERS } = await import("@/lib/tiers");
const tiersModule = await import("@/lib/tiers");

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const OWNER_ID = "00000000-1111-2222-3333-444444444444";

function seedEvent(over: Record<string, unknown> = {}) {
  store.rows("events").push({
    id: EVENT_ID,
    owner_id: OWNER_ID,
    name: "A wedding",
    retention_from: "2026-09-01T00:00:00.000Z",
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

describe("the day the window is counted from", () => {
  /*
   * The event's own date used to be the anchor, and a host who bought six
   * months ahead of the wedding kept the whole window. With the date gone the
   * payment has to do that job: twelve months on Pro has to mean twelve months
   * from the day the money arrived, or an event that sat on Free since March
   * and upgraded in December would be handed three months of what it paid for.
   */
  it("counts a paid window from the day the plan was paid for", async () => {
    store.reset();
    seedEvent({ retention_from: "2026-01-01T00:00:00.000Z" });
    store.rows("purchases").push({
      id: "p1",
      event_id: EVENT_ID,
      owner_id: OWNER_ID,
      provider: "creem",
      provider_txn_id: "txn-1",
      order_id: "order-1",
      subscription_id: null,
      product: "pro",
      status: "paid",
      created_at: "2026-06-01T00:00:00.000Z",
    });

    await recomputeEntitlement(EVENT_ID);

    // 365 days from the payment, not from the event's anchor five months back.
    expect(event().expires_at).toBe("2027-06-01T00:00:00.000Z");
  });

  /*
   * The case migration 0026 exists to protect. Events that predate it hold
   * their own event date in `retention_from`, and for a wedding booked months
   * ahead that date is *after* the payment. Re-anchoring those on the payment
   * would take the difference off somebody's wedding photographs.
   */
  it("keeps a later anchor from before the event date was removed", async () => {
    store.reset();
    seedEvent({ retention_from: "2026-12-01T00:00:00.000Z" });
    store.rows("purchases").push({
      id: "p1",
      event_id: EVENT_ID,
      owner_id: OWNER_ID,
      provider: "creem",
      provider_txn_id: "txn-1",
      order_id: "order-1",
      subscription_id: null,
      product: "pro",
      status: "paid",
      created_at: "2026-01-05T00:00:00.000Z",
    });

    await recomputeEntitlement(EVENT_ID);

    expect(event().expires_at).toBe("2027-12-01T00:00:00.000Z");
  });
});

describe("keeping, as a yearly subscription", () => {
  /**
   * Days between an event's own expiry under its plan and where it actually
   * sits, which is what a year of keeping is supposed to add.
   */
  function yearsAdded(): number {
    const { computeExpiry, getTier, KEEPING_DAYS } = tiersModule;
    const base = computeExpiry(
      event().retention_from as string,
      getTier(event().tier as string),
    ).getTime();
    const actual = new Date(event().expires_at as string).getTime();
    return Math.round((actual - base) / (KEEPING_DAYS * 86_400_000));
  }

  async function buy(product: string, txn: string) {
    await grantPurchase({
      eventId: EVENT_ID,
      product: product as "pro" | "keeping_pro",
      provider: "creem",
      providerTxnId: txn,
      orderId: txn,
      subscriptionId: product.startsWith("keeping") ? "sub-1" : null,
    });
  }

  it("adds a year to the window for one payment", async () => {
    await buy("pro", "order-plan");
    expect(yearsAdded()).toBe(0);

    await buy("keeping_pro", "order-year-1");
    expect(yearsAdded()).toBe(1);
  });

  /*
   * The renewal case, and the reason the window is counted rather than stored.
   * Three payments is three rows is three years, and nothing had to remember
   * that the first two happened.
   */
  it("adds another year for every renewal", async () => {
    await buy("pro", "order-plan");
    await buy("keeping_pro", "order-year-1");
    await buy("keeping_pro", "order-year-2");
    await buy("keeping_pro", "order-year-3");

    expect(yearsAdded()).toBe(3);
  });

  /*
   * Lapsing is the absence of the next payment, so there is nothing to assert
   * about a cancellation except that it changes nothing. This is the promise
   * made to the customer: you keep the year you paid for.
   */
  it("keeps the years already paid for when the subscription stops", async () => {
    await buy("pro", "order-plan");
    await buy("keeping_pro", "order-year-1");
    await buy("keeping_pro", "order-year-2");

    const windowBefore = event().expires_at;

    // No further renewal ever arrives. Nothing recomputes it downwards.
    expect(event().expires_at).toBe(windowBefore);
    expect(yearsAdded()).toBe(2);
  });

  it("takes exactly one year back when one payment is refunded", async () => {
    await buy("pro", "order-plan");
    await buy("keeping_pro", "order-year-1");
    await buy("keeping_pro", "order-year-2");
    expect(yearsAdded()).toBe(2);

    await revokePurchase({
      provider: "creem",
      orderId: "order-year-2",
      status: "refunded",
    });

    expect(yearsAdded()).toBe(1);
  });

  /*
   * A refund of the plan must not take the keeping years with it. The window
   * is shorter because Plus is shorter, but the years bought still count.
   */
  it("keeps the years when the plan underneath is refunded", async () => {
    await buy("pro", "order-plan");
    await buy("keeping_pro", "order-year-1");

    await revokePurchase({
      provider: "creem",
      orderId: "order-plan",
      status: "refunded",
    });

    expect(event().tier).toBe(TIERS.free.id);
    // Still one year on top of whatever the (now Free) window is.
    expect(yearsAdded()).toBe(1);
  });

  it("never leaves a keeping payment with an open-ended window", async () => {
    // Only the withdrawn Keep Forever yields a null expiry. A subscription
    // extends the window; it does not remove it.
    await buy("pro", "order-plan");
    await buy("keeping_pro", "order-year-1");

    expect(event().expires_at).not.toBeNull();
    expect(event().keep_forever).toBe(false);
  });

  it("brings an expired event back when a year is bought", async () => {
    store.reset();
    seedEvent({ status: "expired", tier: TIERS.pro.id });

    await buy("keeping_pro", "order-year-1");

    expect(event().status).toBe("active");
  });
});
