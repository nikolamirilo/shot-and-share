import "server-only";

import { ApiError } from "@/lib/api";
import type { Product } from "@/lib/db/types";
import { env } from "@/lib/env";
import { createCheckoutUrl, isCheckoutConfigured } from "@/lib/payments/creem";

/**
 * "Give me a checkout URL for this event", for callers that have already
 * proved the host owns it.
 *
 * Lives here rather than in the route handler because both the route and the
 * upgrade action need it, and the action used to get at it by making an HTTP
 * request to our own public URL with the host's cookies forwarded. That works
 * right up until something in front of the app - deployment protection, a
 * firewall rule, a challenge page - answers first, and then the action gets
 * HTML where it expected JSON and the whole event page renders a 500.
 *
 * A function call cannot be intercepted by an edge that has never heard of it.
 *
 * No authorisation happens in here on purpose: the two callers prove ownership
 * differently - one throws into a JSON body, the other redirects into a form -
 * and folding that in would mean picking one and breaking the other.
 */
export async function checkoutUrlForEvent(args: {
  product: Product;
  eventId: string;
  ownerId: string;
  email?: string | null;
}): Promise<string> {
  /*
   * `product` rides along so the page the host lands on can tell whether the
   * thing they just paid for has arrived yet, rather than saying "reload and
   * see" to somebody whose plan already moved.
   *
   * A hint and nothing more, like `purchase` beside it. Both are typed by
   * whoever holds the URL, so neither grants anything - the plan is still moved
   * only by the signed webhook, or by recovery asking the provider directly.
   */
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
