"use client";

import { useServerAction } from "@/hooks/use-server-action";

import { startCheckout } from "@/lib/actions/billing";
import { Alert, Button, Hole, Panel } from "@/components/ui";
import type { TierId } from "@/lib/tiers";
import { KEEP_FOREVER, type PurchasableId, TIERS } from "@/lib/tiers";
import { formatBytes } from "@/lib/format";

export function UpgradePanel({
  eventId,
  tier,
  keepForever,
}: {
  eventId: string;
  tier: TierId;
  keepForever: boolean;
}) {
  const { pending, error, run } = useServerAction();

  function buy(product: PurchasableId) {
    run(() => startCheckout(eventId, product), {
      onSuccess: (result) => {
        if (result.url) window.location.href = result.url;
      },
    });
  }

  const options: Array<{ product: PurchasableId; title: string; body: string; price: number }> =
    [];

  if (tier === "free") {
    options.push({
      product: "event",
      title: `Move up to ${TIERS.event.name}`,
      body: `${formatBytes(TIERS.event.quotaBytes, 0)}, video, a custom event page, and photos kept for six months.`,
      price: TIERS.event.priceEur,
    });
  }
  if (tier !== "wedding") {
    options.push({
      product: "wedding",
      title: `Move up to ${TIERS.wedding.name}`,
      body: `${formatBytes(TIERS.wedding.quotaBytes, 0)}, twelve months, a branded print-ready card, and the live slideshow.`,
      price: TIERS.wedding.priceEur,
    });
  }
  if (!keepForever) {
    options.push({
      product: "keep_forever",
      title: `Add ${KEEP_FOREVER.name}`,
      body: "Photos stay permanently. Paid once and never again - not every year.",
      price: KEEP_FOREVER.priceEur,
    });
  }

  if (options.length === 0) {
    return (
      <Panel title="Nothing left to buy">
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ash">
          This event is on {TIERS.wedding.name} with {KEEP_FOREVER.name} added.
          The photos are kept permanently and there is no subscription running
          in the background.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="More room, or more time">
      <p className="mt-2 text-[0.9375rem] text-ash">
        One payment per event. Upgrading during the night works fine - the limit
        lifts the moment the payment clears.
      </p>

      <ul className="mt-5 space-y-3">
        {options.map((option) => (
          <li
            key={option.product}
            className="note p-4"
          >
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <div className="flex items-start gap-2.5">
                  <Hole size={10} className="mt-2" />
                  <h3 className="text-[1.0625rem] font-bold leading-snug">
                    {option.title}
                  </h3>
                </div>
                <p className="mt-1.5 text-[0.9375rem] leading-snug text-ash">
                  {option.body}
                </p>
              </div>
              <p
                className="shrink-0 font-display text-[1.5rem] font-extrabold tracking-[-0.04em]"
                style={{ fontStretch: "86%" }}
              >
                €{option.price}
              </p>
            </div>
            <Button
              onClick={() => buy(option.product)}
              disabled={pending}
              size="sm"
              className="mt-3 w-full"
            >
              {pending ? "Opening checkout…" : `Buy for €${option.price}`}
            </Button>
          </li>
        ))}
      </ul>

      {error && <Alert className="mt-4">{error}</Alert>}
    </Panel>
  );
}
