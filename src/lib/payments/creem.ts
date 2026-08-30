import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { Product } from "@/lib/db/types";
import { env, hasCreem } from "@/lib/env";
import { CREEM_PRODUCTS, PURCHASABLE_IDS } from "@/lib/tiers";

/**
 * Creem acts as merchant of record.
 *
 * Stripe does not operate for a Serbian entity, and a merchant of record also
 * takes EU VAT registration and filing off the table entirely. Creem is the
 * successor to Lemon Squeezy here: same arrangement, same reason, a cheaper
 * fee, and an API that names an order rather than a JSON:API document.
 *
 * ---------------------------------------------------------------------------
 * The products must be configured TAX-INCLUSIVE.
 *
 * Every price this product shows a customer is quoted inclusive of EU VAT - see
 * `VAT_NOTE` in `@/lib/tiers`, which is the single sentence the homepage, the
 * pricing page and the terms all print. EU consumer rules require the figure
 * shown to a consumer to be the figure they are charged.
 *
 * Nothing here can enforce that. `tax_mode` is a per-product setting in the
 * Creem dashboard, and if a product is left `exclusive` then €19 on the pricing
 * page becomes €22.80 at checkout and the published price is a misleading one.
 * Check it whenever a product is created or replaced.
 * ---------------------------------------------------------------------------
 */

/** A value off the wire, only if it names something that can be bought. */
function asPurchasable(value: unknown): Product | null {
  return PURCHASABLE_IDS.includes(value as Product) ? (value as Product) : null;
}

/**
 * The configured product per plan, or undefined where there is none.
 *
 * Deliberately not `TIERS.plus.id`: a tier falls back to its plan key when the
 * product is unset, and a fallback is exactly what must not be sent to a
 * checkout. This asks whether a real Creem product exists, which is the
 * question `isCheckoutConfigured` and the webhook fallback are both really
 * asking.
 */
function products(): Record<Product, string | undefined> {
  return {
    plus: CREEM_PRODUCTS.plus,
    pro: CREEM_PRODUCTS.pro,
    keep_forever: CREEM_PRODUCTS.keep_forever,
  };
}

/** A Creem product id back to the plan key it sells. */
function planForProductId(productId: string | null): Product | null {
  if (!productId) return null;
  return asPurchasable(
    Object.entries(products()).find(([, id]) => id && id === productId)?.[0],
  );
}

export function isCheckoutConfigured(product: Product): boolean {
  return hasCreem() && Boolean(products()[product]);
}

/* -------------------------------------------------------------------------- */
/*  Requests                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Every call carries the key in `x-api-key`, and the key itself decides whether
 * it lands on the sandbox or on real money - see `env.creem.apiBase`.
 */
function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": env.creem.apiKey ?? "",
  };
}

export async function createCheckoutUrl(args: {
  product: Product;
  eventId: string;
  ownerId: string;
  email?: string | null;
  redirectUrl: string;
}): Promise<string> {
  const productId = products()[args.product];
  if (!hasCreem() || !productId) {
    throw new Error("Creem is not configured for this product.");
  }

  const res = await fetch(`${env.creem.apiBase}/v1/checkouts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      product_id: productId,
      // Comes back on the webhook. This is how a payment finds its event.
      metadata: {
        event_id: args.eventId,
        owner_id: args.ownerId,
        product: args.product,
      },
      /*
       * Echoed on the redirect, on the checkout object, and on the checkout
       * nested inside a refund - which is the one place a join key survives
       * when metadata does not. Only ever a hint, though: entitlement is
       * decided by the metadata above, delivered over a signed webhook.
       *
       * Unique per attempt rather than just the event id. Creem does not
       * document `request_id` as an idempotency key, and it does document a
       * 400 for duplicate resources - so a host who abandons checkout and
       * presses Buy again must not be the one who finds out which it is.
       */
      request_id: `${args.eventId}:${args.product}:${randomUUID().slice(0, 8)}`,
      success_url: args.redirectUrl,
      ...(args.email ? { customer: { email: args.email } } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(`Creem checkout failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { checkout_url?: string };
  const url = body.checkout_url;
  if (!url) throw new Error("Creem returned no checkout URL.");
  return url;
}

/* -------------------------------------------------------------------------- */
/*  Webhooks                                                                   */
/* -------------------------------------------------------------------------- */

/** Length first, because `timingSafeEqual` throws on buffers of unequal size. */
function equals(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * How far out of date a Standard Webhooks timestamp may be. Five minutes, the
 * same window the Creem SDK uses.
 */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Creem signs webhooks two different ways, and which one you get is a property
 * of the account rather than of the request.
 *
 * The published documentation describes only the older scheme: hex HMAC-SHA256
 * of the raw body under the webhook secret, in a `creem-signature` header. The
 * official SDK checks a Standard Webhooks scheme *first* - `webhook-id`,
 * `webhook-timestamp` and `webhook-signature`, base64 rather than hex, over
 * `id.timestamp.body`, keyed on the base64-decoded secret with its `whsec_`
 * prefix removed - and only falls back to the documented one.
 *
 * So both are implemented here, in that order, and this is not defensive
 * padding: an integration that trusts the documentation and gets an account on
 * the newer scheme rejects every delivery it is sent, and the symptom is
 * paying customers whose plan never changes.
 *
 * Modelled on `verifyWebhookSignature` in `creem@1.6.0`, deliberately including
 * its exact quirks - the `sha256=` prefix it strips, the `x-creem-signature`
 * spelling it also accepts, and its refusal to fall back to the old scheme once
 * the new headers are present.
 */
export function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = env.creem.webhookSecret;
  if (!secret) return false;

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const standard = headers.get("webhook-signature");

  if (id && timestamp && standard) {
    const seconds = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(seconds)) return false;

    // Both directions. A timestamp from the future is a replayed capture with
    // the clock wound forward just as much as an old one is a replayed capture.
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - seconds) > TOLERANCE_SECONDS) return false;

    const key = Buffer.from(
      secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret,
      "base64",
    );
    const expected = createHmac("sha256", key)
      .update(`${id}.${seconds}.${rawBody}`)
      .digest("base64");

    // A space-separated list, each entry `<version>,<signature>`, so a secret
    // can be rotated without a delivery falling in the gap.
    return standard
      .split(" ")
      .some((entry) => {
        const [version, signature] = entry.split(",");
        return version === "v1" && Boolean(signature) && equals(signature!, expected);
      });
  }

  const legacy =
    headers.get("creem-signature") ?? headers.get("x-creem-signature");
  if (!legacy) return false;

  const trimmed = legacy.trim();
  const offered = (
    trimmed.startsWith("sha256=") ? trimmed.slice("sha256=".length) : trimmed
  ).toLowerCase();

  return equals(
    offered,
    createHmac("sha256", secret).update(rawBody).digest("hex"),
  );
}

export interface ParsedWebhook {
  eventName: string;
  /** The idempotency key: the order this delivery concerns, where there is one. */
  txnId: string;
  eventId: string | null;
  /** The buyer, off checkout metadata. Null on anything bought elsewhere. */
  ownerId: string | null;
  product: Product | null;
  /**
   * The order this concerns, which is what a refund names.
   *
   * Creem hangs the order off every payment-shaped event - the checkout, the
   * refund and the dispute all carry the same `order` object - so this is one
   * lookup rather than three call sites each knowing a different shape.
   */
  orderId: string | null;
  subscriptionId: string | null;
  amountCents: number | null;
  currency: string | null;
  status: string | null;
}

/**
 * Creem writes a related object either as a bare id string or as the expanded
 * object, depending on the event. Both mean the same thing here.
 */
function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function parseWebhook(payload: unknown): ParsedWebhook | null {
  const body = payload as {
    eventType?: string;
    type?: string;
    object?: unknown;
    data?: unknown;
  };

  /*
   * `eventType`/`object` is the documented envelope and the one every sample
   * shows. `type`/`data` is read too because the official SDK's own parser
   * accepts either, which is the only evidence anyone outside Creem has about
   * what a second envelope shape would look like.
   */
  const eventName = body.eventType ?? body.type;
  const subject = obj(body.object ?? body.data);
  const subjectId = idOf(subject);
  if (!eventName || !subjectId) return null;

  /*
   * Where each shape keeps things:
   *
   *   checkout.completed  object is the checkout - order, product, customer,
   *                       subscription and our metadata all hang off it.
   *   refund.created      object is the refund - the original checkout (with
   *   dispute.created     its metadata) and the order both hang off it.
   *   subscription.*      object is the subscription - it carries the metadata
   *                       Creem copied from the checkout that created it.
   */
  const checkout = obj(subject.checkout);
  const order = obj(subject.order);
  const subscription = obj(subject.subscription);

  const metadata = obj(
    subject.metadata ?? checkout.metadata ?? subscription.metadata,
  );

  /*
   * What was bought is whatever Creem says was bought, and nothing else.
   *
   * Metadata looks like the obvious source - our own checkout puts the plan
   * key there - but metadata is not ours alone. A Creem payment link takes
   * `?metadata[key]=value` straight off the query string, and our product ids
   * are `NEXT_PUBLIC_`, so they are in the browser bundle and in every checkout
   * URL. Reading the plan out of metadata first therefore means anyone can open
   * the Plus product's own payment link with `metadata[product]=pro`, pay €19,
   * and be handed a genuine, correctly signed `checkout.completed` that grants
   * Pro. The signature is not the thing that fails - the payment is real. It is
   * the wrong plan.
   *
   * So the plan comes off the product id, which only Creem can set, and this
   * fails closed: a product id we do not recognise grants nothing rather than
   * falling through to something the buyer typed.
   *
   * Validated rather than cast. These are strings off the wire, and casting one
   * to Product would tell the compiler a thing it has no way to know.
   */
  const product = planForProductId(
    idOf(order.product) ??
      idOf(subject.product) ??
      idOf(checkout.product) ??
      idOf(subscription.product),
  );

  // Kept only to say so out loud. Our own checkout always sets the two to
  // match, so a disagreement is either somebody trying the above or a product
  // id pointed at the wrong plan - and both are worth a line in the log.
  const claimed = asPurchasable(metadata.product);
  if (claimed && product && claimed !== product) {
    console.warn(
      "[webhook] checkout metadata names a different plan than the product that was paid for",
      { claimed, paidFor: product, order: idOf(subject.order) },
    );
  }

  const isSubscriptionSubject = subject.object === "subscription";

  const orderId =
    idOf(subject.order) ?? idOf(obj(subject.transaction).order) ?? null;

  const subscriptionId = isSubscriptionSubject
    ? subjectId
    : (idOf(subject.subscription) ??
      idOf(obj(subject.transaction).subscription) ??
      null);

  return {
    eventName,
    /*
     * The order, not the delivery. Recovery writes the same id when it applies
     * an order the webhook never delivered, so the unique constraint on
     * (provider, provider_txn_id) recognises a late delivery as a duplicate
     * instead of granting the same purchase twice.
     */
    txnId: orderId ?? subjectId,
    eventId: str(metadata.event_id),
    ownerId: str(metadata.owner_id),
    product,
    orderId,
    subscriptionId,
    /*
     * What the customer was actually charged, not the net figure.
     *
     * `amount` is the order before tax and `amount_paid` is the total with it -
     * 1000 against 1210 in Creem's own example. Our products are configured
     * tax-inclusive, so under normal operation the two are equal and this only
     * matters if one is ever left exclusive by mistake. `refund_amount` is the
     * refund object's own spelling, and is the only amount a refund carries
     * when Creem sends the order as a bare id rather than expanded.
     */
    amountCents:
      num(order.amount_paid) ??
      num(order.amount) ??
      num(subject.refund_amount) ??
      num(subject.amount),
    currency:
      str(order.currency) ??
      str(subject.refund_currency) ??
      str(subject.currency),
    status: str(subject.status),
  };
}

/* -------------------------------------------------------------------------- */
/*  Recovery                                                                   */
/* -------------------------------------------------------------------------- */

export interface ProviderOrder {
  /** The order id, which is also what `checkout.completed` arrives under. */
  id: string;
  /** What it bought, resolved from the product. Null if we do not sell it. */
  product: Product | null;
  status: string;
  amountCents: number | null;
  currency: string | null;
  createdAt: string | null;
}

async function get(path: string): Promise<Response> {
  return fetch(`${env.creem.apiBase}${path}`, {
    headers: { "x-api-key": env.creem.apiKey ?? "" },
    // The whole point is to see something that was not there a moment ago.
    cache: "no-store",
  });
}

/**
 * Recent paid orders for one email address.
 *
 * This is the fallback for a webhook that was slow, lost, or delivered while
 * the deployment was mid-restart. "I paid and got nothing" is the single
 * biggest source of support tickets on one-time purchases, and a ticket that
 * goes unanswered for a day becomes a chargeback - which is exactly the number
 * a payment reviewer is trying to predict.
 *
 * The provider is asked rather than the browser believed. A redirect back from
 * checkout proves nothing; an order sitting in the provider's own records under
 * the signed-in host's email proves the money moved.
 *
 * Metadata does not come back on the orders endpoint, so an order cannot say
 * which event it was for. That is why the caller matches on "paid by this host
 * and not recorded against anything yet" instead.
 *
 * Three calls, because Creem indexes orders by customer rather than by email:
 * the customer is looked up by email, their orders are listed, and their
 * transactions are listed so a refunded or charged-back order can be dropped -
 * `OrderStatus` is only ever `pending` or `paid`, so the order alone never says
 * the money came back.
 */
export async function listRecentOrders(
  email: string,
  limit = 10,
): Promise<ProviderOrder[]> {
  /*
   * A page far larger than the answer, sorted here rather than there.
   *
   * Creem's list endpoints take no sort parameter and document no ordering, so
   * asking for ten and hoping they are the newest ten is a guess. Ask for a
   * page nobody realistically fills, order it ourselves, and take the newest -
   * `created_at` is an ISO-8601 string on an order, which sorts correctly as
   * text. 50 is the largest page size Creem uses as a default anywhere in its
   * own API, so it is the largest value known to be accepted.
   */
  const PAGE = 50;
  if (!hasCreem()) return [];

  const customerRes = await get(
    `/v1/customers?email=${encodeURIComponent(email)}`,
  );

  // A host who has never bought anything has no customer record. Ordinary, not
  // an error, and the commonest outcome of pressing the recovery button.
  if (customerRes.status === 404) return [];
  if (!customerRes.ok) {
    console.error(
      "[recovery] could not find the customer",
      customerRes.status,
      await customerRes.text(),
    );
    return [];
  }

  const customerId = idOf(await customerRes.json());
  if (!customerId) return [];

  const [ordersRes, txnRes] = await Promise.all([
    get(`/v1/customers/${encodeURIComponent(customerId)}/orders?page_size=${PAGE}`),
    get(
      `/v1/transactions/search?customer_id=${encodeURIComponent(customerId)}&page_size=${PAGE}`,
    ),
  ]);

  if (!ordersRes.ok) {
    console.error(
      "[recovery] could not list orders",
      ordersRes.status,
      await ordersRes.text(),
    );
    return [];
  }

  const orders = (await ordersRes.json()) as {
    items?: Array<Record<string, unknown>>;
  };

  /*
   * Money that came back, keyed by the order it came back on.
   *
   * A failure here is not fatal: the order list is what recovery is really
   * about, and refusing to recover anything because a second endpoint was
   * briefly unavailable would defeat the point. It falls back to trusting the
   * order, and a refund the webhook already handled has a purchase row against
   * it anyway, so it would be skipped as recorded.
   */
  const settled = new Set(["paid", "pending"]);
  const returned = new Set<string>();
  if (txnRes.ok) {
    const txns = (await txnRes.json()) as {
      items?: Array<Record<string, unknown>>;
    };
    for (const txn of txns.items ?? []) {
      const orderId = idOf(txn.order);
      const status = str(txn.status);
      if (orderId && status && !settled.has(status)) returned.add(orderId);
    }
  } else {
    console.warn("[recovery] could not list transactions", txnRes.status);
  }

  return (orders.items ?? [])
    .map((order) => ({ order, id: idOf(order) }))
    .filter(
      (row): row is { order: Record<string, unknown>; id: string } =>
        row.id !== null && !returned.has(row.id),
    )
    .map(({ order, id }) => ({
      id,
      product: planForProductId(idOf(order.product)),
      status: str(order.status) ?? "unknown",
      // The charged figure, for the same reason the webhook records it.
      amountCents: num(order.amount_paid) ?? num(order.amount),
      currency: str(order.currency),
      createdAt: str(order.created_at),
    }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, limit);
}
