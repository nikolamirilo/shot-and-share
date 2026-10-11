import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { ApiError, fail, handle } from "@/lib/api";
import { requireOwnedEvent, requireUser } from "@/lib/guards/host-api";
import { env } from "@/lib/env";
import { grantPurchase } from "@/lib/payments/grant";
import {
  KEEPING,
  PURCHASABLE_IDS,
  TIERS,
  type PurchasableId,
} from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    if (env.isProduction || !env.mockCheckout) {
      return fail("not_found", "Not available.");
    }

    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId") ?? "";
    const product = (url.searchParams.get("product") ?? "") as PurchasableId;

    if (!PURCHASABLE_IDS.includes(product)) {
      throw new ApiError("bad_request", "Unknown product.");
    }

    await requireUser();
    await requireOwnedEvent(eventId);

    const priceEur =
      product === "keeping_plus"
        ? KEEPING.plus.priceEur
        : product === "keeping_pro"
          ? KEEPING.pro.priceEur
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
