import { z } from "zod";

import { ApiError, handle, ok, parseBody } from "@/lib/api";
import { env } from "@/lib/env";
import {
  createCheckoutUrl,
  isCheckoutConfigured,
} from "@/lib/payments/lemonsqueezy";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  eventId: z.string().uuid(),
  product: z.enum(["event", "wedding", "keep_forever"]),
});

/**
 * Hands back a hosted checkout URL. That is all it does — no entitlement is
 * granted here, and the redirect the customer lands on afterwards grants
 * nothing either. Only the signed webhook moves a tier.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = await parseBody(request, bodySchema);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError("unauthorized", "Sign in first.");

    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", body.eventId)
      .maybeSingle();
    if (!data) throw new ApiError("not_found", "Event not found.");
    const event = data as EventRow;

    const redirectUrl = `${env.siteUrl}/dashboard/events/${event.id}?purchase=complete`;

    if (isCheckoutConfigured(body.product)) {
      return ok({
        url: await createCheckoutUrl({
          product: body.product,
          eventId: event.id,
          ownerId: user.id,
          email: user.email,
          redirectUrl,
        }),
      });
    }

    if (env.mockCheckout && !env.isProduction) {
      const url = new URL("/api/dev/checkout", env.siteUrl);
      url.searchParams.set("eventId", event.id);
      url.searchParams.set("product", body.product);
      return ok({ url: url.toString(), mock: true });
    }

    throw new ApiError(
      "not_configured",
      "Payments are not configured in this environment yet.",
    );
  });
}
