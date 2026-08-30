import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "./stubs/supabase";

/**
 * The webhook, end to end.
 *
 * The parser and the signature check have their own tests. This one is about
 * the route that joins them to the money: which event names move a tier, and
 * which are acknowledged and ignored. Every one of those is a decision that
 * only shows up in production, on somebody's wedding, if it is wrong.
 */

const SECRET = "whsec_test_secret";
const store = createStore();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => store.client,
}));

const { POST } = await import("@/app/api/webhooks/creem/route");
const { TIERS } = await import("@/lib/tiers");

const EVENT_ID = "11111111-2222-3333-4444-555555555555";
const OWNER_ID = "00000000-1111-2222-3333-444444444444";

function seedEvent() {
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
  });
}

const event = () => store.rows("events")[0];

beforeEach(() => {
  store.reset();
  seedEvent();
  process.env.CREEM_WEBHOOK_SECRET = SECRET;
});

/** A delivery signed the way Creem signs one. */
async function deliver(payload: unknown, over: { signature?: string } = {}) {
  const body = JSON.stringify(payload);
  const signature =
    over.signature ??
    createHmac("sha256", SECRET).update(body).digest("hex");

  const response = await POST(
    new Request("https://example.test/api/webhooks/creem", {
      method: "POST",
      headers: { "creem-signature": signature },
      body,
    }),
  );

  return { status: response.status, body: await response.json() };
}

function purchased(over: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    eventType: "checkout.completed",
    created_at: 1_760_000_000_000,
    object: {
      id: "ch_1",
      object: "checkout",
      status: "completed",
      request_id: `${EVENT_ID}:pro:abcd1234`,
      order: {
        id: "ord_1",
        object: "order",
        customer: "cust_1",
        product: TIERS.pro.id,
        amount: 3900,
        amount_paid: 3900,
        currency: "EUR",
        status: "paid",
        type: "onetime",
      },
      customer: { id: "cust_1", object: "customer", email: "host@example.com" },
      metadata: { event_id: EVENT_ID, owner_id: OWNER_ID, product: "pro" },
      ...over,
    },
  };
}

describe("a payment arriving", () => {
  it("moves the event onto the plan that was paid for", async () => {
    const { status } = await deliver(purchased());

    expect(status).toBe(200);
    expect(event().tier).toBe(TIERS.pro.id);
    expect(event().storage_quota_bytes).toBe(TIERS.pro.quotaBytes);
  });

  it("records the order id, because that is what a refund will name", async () => {
    await deliver(purchased());

    const purchase = store.rows("purchases")[0];
    expect(purchase.provider).toBe("creem");
    expect(purchase.order_id).toBe("ord_1");
    // The same id recovery would write, so a late delivery is a duplicate
    // rather than a second grant.
    expect(purchase.provider_txn_id).toBe("ord_1");
    expect(purchase.amount_cents).toBe(3900);
  });

  /*
   * The one that would be theft.
   *
   * A Creem payment link takes `?metadata[key]=value` off the query string, and
   * our product ids are in the browser bundle. So a buyer can open the Plus
   * product's own link claiming `metadata[product]=pro`, pay €19, and produce a
   * genuine, correctly signed delivery asking for the €39 plan. The plan has to
   * come off the product Creem actually charged for.
   */
  it("grants the plan that was paid for, not the one the metadata asks for", async () => {
    const lying = purchased({
      order: {
        id: "ord_1",
        object: "order",
        product: TIERS.plus.id,
        amount: 1900,
        currency: "EUR",
        status: "paid",
        type: "onetime",
      },
      metadata: { event_id: EVENT_ID, owner_id: OWNER_ID, product: "pro" },
    });

    await deliver(lying);

    expect(event().tier).toBe(TIERS.plus.id);
    expect(event().storage_quota_bytes).toBe(TIERS.plus.quotaBytes);
    expect(store.rows("purchases")[0].product).toBe("plus");
  });

  it("grants nothing at all for a product we do not sell", async () => {
    const elsewhere = purchased({
      order: { id: "ord_9", object: "order", product: "prod_somebody_elses" },
      metadata: { event_id: EVENT_ID, product: "pro" },
    });

    const { status, body } = await deliver(elsewhere);

    expect(status).toBe(200);
    expect(body).toMatchObject({ ignored: "no_target" });
    expect(event().tier).toBe(TIERS.free.id);
  });
});

describe("money going back", () => {
  beforeEach(async () => {
    await deliver(purchased());
    expect(event().tier).toBe(TIERS.pro.id);
  });

  it("takes the plan back when the order is refunded", async () => {
    const { status } = await deliver({
      id: "evt_2",
      eventType: "refund.created",
      object: {
        id: "ref_1",
        object: "refund",
        status: "succeeded",
        refund_amount: 3900,
        refund_currency: "EUR",
        transaction: { id: "tran_1", object: "transaction", order: "ord_1" },
        order: { id: "ord_1", object: "order", product: TIERS.pro.id },
        checkout: { id: "ch_1", metadata: { event_id: EVENT_ID } },
      },
    });

    expect(status).toBe(200);
    expect(event().tier).toBe(TIERS.free.id);
    expect(store.rows("purchases")[0].status).toBe("refunded");
  });

  /*
   * A chargeback with a merchant of record is money already gone, not money
   * being argued about. Leaving the plan unlocked is product delivered for
   * nothing - and `dispute.created` is the only notice Creem gives.
   */
  it("takes the plan back on a chargeback", async () => {
    const { status } = await deliver({
      id: "evt_3",
      eventType: "dispute.created",
      object: {
        id: "disp_1",
        object: "dispute",
        amount: 3900,
        currency: "EUR",
        transaction: { id: "tran_1", object: "transaction", order: "ord_1" },
        order: { id: "ord_1", object: "order", product: TIERS.pro.id },
        checkout: { id: "ch_1" },
      },
    });

    expect(status).toBe(200);
    expect(event().tier).toBe(TIERS.free.id);
  });

  /*
   * The one that would be a bug. Creem retries a failed card and puts the
   * subscription back to active if one succeeds, so past_due is a window
   * rather than a verdict, and revoking here takes a plan away from somebody
   * who goes on to pay for it.
   */
  it("leaves the plan alone while a payment is still being retried", async () => {
    const { status, body } = await deliver({
      id: "evt_4",
      eventType: "subscription.past_due",
      object: { id: "sub_1", object: "subscription", status: "past_due" },
    });

    expect(status).toBe(200);
    expect(body).toMatchObject({ ignored: "subscription.past_due" });
    expect(event().tier).toBe(TIERS.pro.id);
  });

  it("leaves the plan alone for a cancellation that has not happened yet", async () => {
    const { body } = await deliver({
      id: "evt_5",
      eventType: "subscription.scheduled_cancel",
      object: { id: "sub_1", object: "subscription", status: "active" },
    });

    expect(body).toMatchObject({ ignored: "subscription.scheduled_cancel" });
    expect(event().tier).toBe(TIERS.pro.id);
  });
});

describe("what it refuses", () => {
  it("refuses a body that was not signed with our secret", async () => {
    const { status } = await deliver(purchased(), { signature: "deadbeef" });

    expect(status).toBe(403);
    expect(event().tier).toBe(TIERS.free.id);
  });

  it("refuses to act at all without a webhook secret configured", async () => {
    delete process.env.CREEM_WEBHOOK_SECRET;
    const { status } = await deliver(purchased());

    expect(status).toBe(501);
    expect(event().tier).toBe(TIERS.free.id);
  });

  it("acknowledges a body it cannot make sense of", async () => {
    const { status, body } = await deliver({ hello: "world" });

    expect(status).toBe(200);
    expect(body).toMatchObject({ ignored: "unparseable" });
  });
});
