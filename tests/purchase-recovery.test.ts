import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";

/**
 * The fallback for a webhook that never arrived.
 *
 * "I paid and got nothing" is the biggest source of tickets on a one-time
 * purchase, and an unanswered ticket becomes a chargeback. What matters here is
 * as much what it refuses to do as what it does: it must never invent a
 * purchase, and it must never move an entitlement off another event.
 */

const store = createStore();
const listRecentOrders = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

vi.mock("@/lib/payments/creem", () => ({
  listRecentOrders: (email: string) => listRecentOrders(email),
}));

const { recoverPurchases } = await import("@/lib/payments/recover");
const { TIERS } = await import("@/lib/tiers");

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const OWNER_ID = "00000000-1111-2222-3333-444444444444";

const EVENT = {
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
};

function order(over: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    product: "pro",
    status: "paid",
    amountCents: 3900,
    currency: "EUR",
    createdAt: "2026-08-19T10:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  store.reset();
  listRecentOrders.mockReset();
  store.rows("events").push({ ...EVENT });
});

const event = () => store.rows("events")[0];

describe("finding a payment the webhook lost", () => {
  it("applies an order the provider has and we do not", async () => {
    listRecentOrders.mockResolvedValue([order()]);

    const result = await recoverPurchases(EVENT as never, "host@example.com");

    expect(result).toEqual({ applied: 1, found: 1 });
    expect(event().tier).toBe(TIERS.pro.id);
  });

  /*
   * The same id the webhook would have used. If the delivery turns up late,
   * the unique constraint recognises it and nobody is charged twice or granted
   * twice.
   */
  it("records the order under the id the webhook would have used", async () => {
    listRecentOrders.mockResolvedValue([order()]);
    await recoverPurchases(EVENT as never, "host@example.com");

    const purchase = store.rows("purchases")[0];
    expect(purchase.provider_txn_id).toBe("order-1");
    expect(purchase.order_id).toBe("order-1");
  });

  /*
   * The rule that stops recovery quietly rearranging what somebody paid for.
   * An order already unlocking another event is a previous purchase, and moving
   * it here would take that event's plan away.
   */
  it("leaves an order that already unlocked a different event alone", async () => {
    store.rows("purchases").push({
      event_id: "99999999-8888-7777-6666-555555555555",
      owner_id: OWNER_ID,
      provider: "creem",
      provider_txn_id: "order-1",
      order_id: "order-1",
      product: "pro",
      status: "paid",
    });
    listRecentOrders.mockResolvedValue([order()]);

    const result = await recoverPurchases(EVENT as never, "host@example.com");

    expect(result.applied).toBe(0);
    expect(event().tier).toBe(TIERS.free.id);
  });
});

describe("what it refuses", () => {
  it("ignores an order that is not paid", async () => {
    listRecentOrders.mockResolvedValue([order({ status: "pending" })]);

    const result = await recoverPurchases(EVENT as never, "host@example.com");

    expect(result.applied).toBe(0);
    expect(event().tier).toBe(TIERS.free.id);
  });
});
