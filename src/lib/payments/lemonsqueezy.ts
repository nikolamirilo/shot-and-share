import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { Product } from "@/lib/db/types";
import { env, hasLemonSqueezy } from "@/lib/env";

/**
 * Lemon Squeezy acts as merchant of record.
 *
 * Stripe does not operate for a Serbian entity, and a merchant of record also
 * takes EU VAT registration and filing off the table entirely. It costs about
 * 5% + $0.50 against Stripe's 2.9% + $0.30, which is roughly a euro more on a
 * €39 sale - cheap next to running VAT returns in every member state you sell
 * into. The unit economics are modelled on this fee, not the cheaper one.
 */

function variants(): Record<Product, string | undefined> {
  return {
    free: undefined,
    event: env.lemonSqueezy.variants.event,
    wedding: env.lemonSqueezy.variants.wedding,
    keep_forever: env.lemonSqueezy.variants.keep_forever,
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
  txnId: string;
  eventId: string | null;
  product: Product | null;
  amountCents: number | null;
  currency: string | null;
  status: string | null;
}

export function parseWebhook(payload: unknown): ParsedWebhook | null {
  const body = payload as {
    meta?: {
      event_name?: string;
      custom_data?: { event_id?: string; product?: string };
    };
    data?: {
      id?: string;
      attributes?: {
        total?: number;
        currency?: string;
        status?: string;
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
  let product = (custom.product as Product | undefined) ?? null;
  if (!product) {
    const variantId = String(attrs.first_order_item?.variant_id ?? "");
    product =
      (Object.entries(variants()).find(
        ([, id]) => id && id === variantId,
      )?.[0] as Product | undefined) ?? null;
  }

  return {
    eventName,
    txnId: String(txnId),
    eventId: custom.event_id ?? null,
    product,
    amountCents: typeof attrs.total === "number" ? attrs.total : null,
    currency: attrs.currency ?? null,
    status: attrs.status ?? null,
  };
}
