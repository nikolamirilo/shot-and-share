import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Product } from "@/lib/db/types";
import { env, hasLemonSqueezy } from "@/lib/env";
import { LS_VARIANTS, PURCHASABLE_IDS } from "@/lib/tiers";

/**
 * Lemon Squeezy acts as merchant of record.
 *
 * Stripe does not operate for a Serbian entity, and a merchant of record also
 * takes EU VAT registration and filing off the table entirely. It costs about
 * 5% + $0.50 against Stripe's 2.9% + $0.30, which is roughly a euro more on a
 * €39 sale - cheap next to running VAT returns in every member state you sell
 * into. The unit economics are modelled on this fee, not the cheaper one.
 */

/** A value off the wire, only if it names something that can be bought. */
function asPurchasable(value: unknown): Product | null {
  return PURCHASABLE_IDS.includes(value as Product) ? (value as Product) : null;
}

/**
 * The configured variant per product, or undefined where there is none.
 *
 * Deliberately not `TIERS.plus.id`: a tier falls back to its plan key when the
 * variant is unset, and a fallback is exactly what must not be sent to a
 * checkout. This asks whether a real variant exists, which is the question
 * `isCheckoutConfigured` and the webhook fallback are both really asking.
 */
function variants(): Record<Product, string | undefined> {
  return {
    plus: LS_VARIANTS.plus,
    pro: LS_VARIANTS.pro,
    keep_forever: LS_VARIANTS.keep_forever,
  };
}

export function isCheckoutConfigured(product: Product): boolean {
  return hasLemonSqueezy() && Boolean(variants()[product]);
}

export async function createCheckoutUrl(args: {
  product: Product;
  eventId: string;
  ownerId: string;
  email?: string | null;
  redirectUrl: string;
}): Promise<string> {
  const variantId = variants()[args.product];
  if (!hasLemonSqueezy() || !variantId) {
    throw new Error("Lemon Squeezy is not configured for this product.");
  }

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${env.lemonSqueezy.apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: args.email ?? undefined,
            // Comes back on the webhook. This is how a payment finds its event.
            custom: {
              event_id: args.eventId,
              owner_id: args.ownerId,
              product: args.product,
            },
          },
          product_options: { redirect_url: args.redirectUrl },
        },
        relationships: {
          store: {
            data: { type: "stores", id: String(env.lemonSqueezy.storeId) },
          },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Lemon Squeezy checkout failed: ${res.status} ${await res.text()}`,
    );
  }

  const body = (await res.json()) as {
    data?: { attributes?: { url?: string } };
  };
  const url = body.data?.attributes?.url;
  if (!url) throw new Error("Lemon Squeezy returned no checkout URL.");
  return url;
}

export function verifySignature(rawBody: string, signature: string): boolean {
  if (!env.lemonSqueezy.webhookSecret) return false;
  const expected = createHmac("sha256", env.lemonSqueezy.webhookSecret)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface ParsedWebhook {
  eventName: string;
  /** The idempotency key: this delivery's subject id. */
  txnId: string;
  eventId: string | null;
  /** The buyer, off checkout custom data. Null on anything bought elsewhere. */
  ownerId: string | null;
  product: Product | null;
  /**
   * The order this concerns, which is what a refund names.
   *
   * On an order event it is the subject itself. On a subscription event the
   * subject is the subscription and the order is an attribute, so the two are
   * pulled apart here rather than at three call sites.
   */
  orderId: string | null;
  subscriptionId: string | null;
  amountCents: number | null;
  currency: string | null;
  status: string | null;
}

export function parseWebhook(payload: unknown): ParsedWebhook | null {
  const body = payload as {
    meta?: {
      event_name?: string;
      custom_data?: {
        event_id?: string;
        owner_id?: string;
        product?: string;
      };
    };
    data?: {
      id?: string;
      type?: string;
      attributes?: {
        total?: number;
        currency?: string;
        status?: string;
        order_id?: number | string;
        first_order_item?: { variant_id?: number };
      };
    };
  };

  const eventName = body.meta?.event_name;
  const txnId = body.data?.id;
  if (!eventName || !txnId) return null;

  const custom = body.meta?.custom_data ?? {};
  const attrs = body.data?.attributes ?? {};

  // The product is carried in custom data, but fall back to the variant id so a
  // checkout created outside our own flow still resolves.
  //
  // Validated rather than cast. This is a string off the wire, and casting it
  // to Product told the compiler a thing it had no way to know - which is why
  // the caller carried a `product === "free"` check that looked redundant and
  // was in fact the only thing standing between an unrecognised value and a
  // grant.
  let product = asPurchasable(custom.product);
  if (!product) {
    const variantId = String(attrs.first_order_item?.variant_id ?? "");
    product = asPurchasable(
      Object.entries(variants()).find(([, id]) => id && id === variantId)?.[0],
    );
  }

  /*
   * An order event's subject is the order. A subscription event's subject is
   * the subscription, and the order it was created from is an attribute. Both
   * have to end up in the same two fields or the refund handler has to know
   * which kind of delivery it is looking at.
   */
  const isSubscription = eventName.startsWith("subscription");
  const orderAttr = attrs.order_id;

  return {
    eventName,
    txnId: String(txnId),
    eventId: custom.event_id ?? null,
    ownerId: custom.owner_id ?? null,
    product,
    orderId: isSubscription
      ? orderAttr === undefined || orderAttr === null
        ? null
        : String(orderAttr)
      : String(txnId),
    subscriptionId: isSubscription ? String(txnId) : null,
    amountCents: typeof attrs.total === "number" ? attrs.total : null,
    currency: attrs.currency ?? null,
    status: attrs.status ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/*  Recovery                                                                   */
/* -------------------------------------------------------------------------- */

export interface ProviderOrder {
  /** The order id, which is also what `order_created` arrives under. */
  id: string;
  /** What it bought, resolved from the variant. Null if we do not sell it. */
  product: Product | null;
  status: string;
  amountCents: number | null;
  currency: string | null;
  createdAt: string | null;
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
 * Custom data does not come back on the orders endpoint, so an order cannot say
 * which event it was for. That is why the caller matches on "paid by this host
 * and not recorded against anything yet" instead.
 */
export async function listRecentOrders(
  email: string,
  limit = 10,
): Promise<ProviderOrder[]> {
  if (!hasLemonSqueezy()) return [];

  const url = new URL("https://api.lemonsqueezy.com/v1/orders");
  url.searchParams.set("filter[store_id]", String(env.lemonSqueezy.storeId));
  url.searchParams.set("filter[user_email]", email);
  url.searchParams.set("page[size]", String(limit));
  url.searchParams.set("sort", "-createdAt");

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${env.lemonSqueezy.apiKey}`,
    },
    // The whole point is to see something that was not there a moment ago.
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(
      "[recovery] could not list orders",
      res.status,
      await res.text(),
    );
    return [];
  }

  const body = (await res.json()) as {
    data?: Array<{
      id?: string;
      attributes?: {
        status?: string;
        total?: number;
        currency?: string;
        created_at?: string;
        refunded?: boolean;
        first_order_item?: { variant_id?: number };
      };
    }>;
  };

  const byVariant = variants();

  return (body.data ?? [])
    .filter((order) => order.id && !order.attributes?.refunded)
    .map((order) => {
      const variantId = String(order.attributes?.first_order_item?.variant_id ?? "");
      const product = asPurchasable(
        Object.entries(byVariant).find(([, id]) => id && id === variantId)?.[0],
      );
      return {
        id: String(order.id),
        product,
        status: order.attributes?.status ?? "unknown",
        amountCents:
          typeof order.attributes?.total === "number"
            ? order.attributes.total
            : null,
        currency: order.attributes?.currency ?? null,
        createdAt: order.attributes?.created_at ?? null,
      };
    });
}
