import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { type Product } from "@/types/db";
import { env, hasCreem } from "@/lib/env";
import {
  CREEM_PRODUCTS,
  PURCHASABLE_IDS,
  type PurchasableId,
} from "@/lib/tiers";

/**
 * Creem acts as merchant of record: Stripe does not operate for a Serbian entity, and
 * this takes EU VAT registration off the table.
 */

function asPurchasable(value: unknown): PurchasableId | null {
  return PURCHASABLE_IDS.includes(value as PurchasableId)
    ? (value as PurchasableId)
    : null;
}

function products(): Record<PurchasableId, string | undefined> {
  return {
    plus: CREEM_PRODUCTS.plus,
    pro: CREEM_PRODUCTS.pro,
    keeping_plus: CREEM_PRODUCTS.keeping_plus,
    keeping_pro: CREEM_PRODUCTS.keeping_pro,
  };
}

function planForProductId(productId: string | null): Product | null {
  if (!productId) return null;
  return asPurchasable(
    Object.entries(products()).find(([, id]) => id && id === productId)?.[0],
  );
}

export function isCheckoutConfigured(product: PurchasableId): boolean {
  return hasCreem() && Boolean(products()[product]);
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": env.creem.apiKey ?? "",
  };
}

export async function createCheckoutUrl(args: {
  product: PurchasableId;
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
      metadata: {
        event_id: args.eventId,
        owner_id: args.ownerId,
        product: args.product,
      },
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

/** Length first, because `timingSafeEqual` throws on buffers of unequal size. */
function equals(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Five minutes, the same window the Creem SDK uses. */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Creem signs two different ways, and which one you get is a property of the account
 * rather than of the request - so both are accepted.
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

    // Both directions: a timestamp from the future is a replay with the clock wound
    // forward.
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - seconds) > TOLERANCE_SECONDS) return false;

    const key = Buffer.from(
      secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret,
      "base64",
    );
    const expected = createHmac("sha256", key)
      .update(`${id}.${seconds}.${rawBody}`)
      .digest("base64");

    // A space-separated list of `<version>,<signature>`, so a secret can be rotated.
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
  txnId: string;
  eventId: string | null;
  ownerId: string | null;
  product: Product | null;
  orderId: string | null;
  subscriptionId: string | null;
  amountCents: number | null;
  currency: string | null;
  status: string | null;
}

/** Creem writes a related object either as a bare id or as the expanded object. */
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

  /**
   * `eventType`/`object` is the documented envelope; `type`/`data` is read too because
   * some deliveries use it.
   */
  const eventName = body.eventType ?? body.type;
  const subject = obj(body.object ?? body.data);
  const subjectId = idOf(subject);
  if (!eventName || !subjectId) return null;

  const checkout = obj(subject.checkout);
  const order = obj(subject.order);
  const subscription = obj(subject.subscription);

  const metadata = obj(
    subject.metadata ?? checkout.metadata ?? subscription.metadata,
  );

  /**
   * What was bought is whatever Creem says, never metadata: a Creem payment link
   * takes `?metadata[key]=value` straight off the query string.
   */
  const product = planForProductId(
    idOf(order.product) ??
      idOf(subject.product) ??
      idOf(checkout.product) ??
      idOf(subscription.product),
  );

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
    /**
     * Recovery writes the same id when it applies an order the webhook never delivered,
     * so the unique constraint catches the duplicate.
     */
    txnId: orderId ?? subjectId,
    eventId: str(metadata.event_id),
    ownerId: str(metadata.owner_id),
    product,
    orderId,
    subscriptionId,
    /** `amount` is before tax and `amount_paid` is what the customer was charged. */
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

export interface ProviderOrder {
  id: string;
  product: Product | null;
  status: string;
  amountCents: number | null;
  currency: string | null;
  createdAt: string | null;
}

async function get(path: string): Promise<Response> {
  return fetch(`${env.creem.apiBase}${path}`, {
    headers: { "x-api-key": env.creem.apiKey ?? "" },
    cache: "no-store",
  });
}

export async function listRecentOrders(
  email: string,
  limit = 10,
): Promise<ProviderOrder[]> {
  const PAGE = 50;
  if (!hasCreem()) return [];

  const customerRes = await get(
    `/v1/customers?email=${encodeURIComponent(email)}`,
  );

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
      amountCents: num(order.amount_paid) ?? num(order.amount),
      currency: str(order.currency),
      createdAt: str(order.created_at),
    }))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, limit);
}

export async function billingPortalUrl(email: string): Promise<string | null> {
  if (!hasCreem()) return null;

  const customerRes = await get(
    `/v1/customers?email=${encodeURIComponent(email)}`,
  );

  if (customerRes.status === 404) return null;
  if (!customerRes.ok) {
    console.error(
      "[portal] could not find the customer",
      customerRes.status,
      await customerRes.text(),
    );
    return null;
  }

  const customerId = idOf(await customerRes.json());
  if (!customerId) return null;

  const res = await fetch(`${env.creem.apiBase}/v1/customers/billing`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ customer_id: customerId }),
  });

  if (!res.ok) {
    console.error("[portal] could not create a portal session", res.status, await res.text());
    return null;
  }

  const body = (await res.json()) as Record<string, unknown>;

  /**
   * Creem has spelled this `customer_portal_link` and `url` across versions of its
   * docs.
   */
  const url =
    typeof body.customer_portal_link === "string"
      ? body.customer_portal_link
      : typeof body.url === "string"
        ? body.url
        : null;

  if (!url) {
    console.error("[portal] portal session had no link", Object.keys(body));
  }
  return url;
}
