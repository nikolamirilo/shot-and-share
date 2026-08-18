import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { ApiError, fail, handle } from "@/lib/api";
import { requireOwnedEvent, requireUser } from "@/lib/host";
import { env } from "@/lib/env";
import { grantPurchase } from "@/lib/payments/grant";
import { KEEP_FOREVER, PURCHASABLE_IDS, TIERS } from "@/lib/tiers";
import type { Product } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Development stand-in for the hosted checkout.
 *
 * It exists so the upgrade path - quota rejection, upgrade prompt, tier change,
 * new expiry - can be exercised without a payment provider account. It refuses
 * to run in production, and it goes through the same grant function the real
 * webhook uses, so it cannot drift from the code that handles actual money.
 */
export async function GET(request: Request) {
  return handle(async () => {
    if (env.isProduction || !env.mockCheckout) {
      return fail("not_found", "Not available.");
    }

    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") ?? "";
    const product = (url.searchParams.get("product") ?? "") as Product;

    if (!PURCHASABLE_IDS.includes(product)) {
      throw new ApiError("bad_request", "Unknown product.");
    }

    // Both are guards here: nothing below needs the row, only the assurance
    // that this host owns it.
    await requireUser();
    await requireOwnedEvent(eventId);

    const priceEur =
      product === KEEP_FOREVER.key
        ? KEEP_FOREVER.priceEur
        : TIERS[product].priceEur;

    await grantPurchase({
      eventId,
      product,
      provider: "mock",
      providerTxnId: `mock_${randomUUID()}`,
      amountCents: priceEur * 100,
      currency: "EUR",
      raw: { mock: true },
    });

    return NextResponse.redirect(
      new URL(`/dashboard/events/${eventId}?purchase=mock`, env.siteUrl),
      { status: 303 },
    );
  });
}
