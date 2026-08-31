import { z } from "zod";

import { handle, ok, parseBody } from "@/lib/api";
import { requireOwnedEvent, requireUser } from "@/lib/host";
import { PURCHASABLE_IDS } from "@/lib/tiers";
import { checkoutUrlForEvent } from "@/lib/payments/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  product: z.enum(PURCHASABLE_IDS),
});

/**
 * Hands back a hosted checkout URL. That is all it does - no entitlement is
 * granted here, and the redirect the customer lands on afterwards grants
 * nothing either. Only the signed webhook moves a tier.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    const { user } = await requireUser();
    const event = await requireOwnedEvent(body.eventId);

    return ok({
      url: await checkoutUrlForEvent({
        product: body.product,
        eventId: event.id,
        ownerId: user.id,
        email: user.email,
      }),
    });
  });
}
