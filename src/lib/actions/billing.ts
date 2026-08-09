"use server";

import { headers } from "next/headers";

import { requireOwnedEvent } from "@/lib/actions/guards";
import { env } from "@/lib/env";
import type { PurchasableId } from "@/lib/tiers";
import { clientIp } from "@/lib/ratelimit";

/** Used by the upgrade buttons to reach the payment provider. */
export async function startCheckout(
  eventId: string,
  product: PurchasableId,
): Promise<{ url?: string; error?: string }> {
  await requireOwnedEvent(eventId);
  const requestHeaders = await headers();

  const res = await fetch(`${env.siteUrl}/api/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: requestHeaders.get("cookie") ?? "",
      "x-forwarded-for": clientIp(requestHeaders),
    },
    body: JSON.stringify({ eventId, product }),
  });

  const body = (await res.json()) as
    | { url: string }
    | { error: { message: string } };

  if ("error" in body) return { error: body.error.message };
  return { url: body.url };
}
