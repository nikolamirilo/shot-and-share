import "server-only";

import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";
import type { PurchasableId } from "@/lib/tiers";
import { createCheckoutUrl, isCheckoutConfigured } from "@/lib/payments/creem";

export async function checkoutUrlForEvent(args: {
  product: PurchasableId;
  eventId: string;
  ownerId: string;
  email?: string | null;
}): Promise<string> {
  const redirectUrl = `${env.siteUrl}/dashboard/events/${args.eventId}?purchase=complete&product=${args.product}`;

  if (isCheckoutConfigured(args.product)) {
    return createCheckoutUrl({ ...args, redirectUrl });
  }

  if (env.mockCheckout && !env.isProduction) {
    const url = new URL("/api/dev/checkout", env.siteUrl);
    url.searchParams.set("eventId", args.eventId);
    url.searchParams.set("product", args.product);
    return url.toString();
  }

  throw new ApiError(
    "not_configured",
    "Payments are not configured in this environment yet.",
  );
}
