"use client";

import { MdOutlineReceiptLong, MdOutlineShoppingCartCheckout } from "react-icons/md";

import { useServerAction } from "@/hooks/useServerAction";

import {
  openBillingPortal,
  recoverPurchase,
  startCheckout,
} from "@/lib/actions/billing";
import { Alert, Button, Hole, Panel } from "@/components/ui";
import { useState } from "react";
import {
  KEEPING_NAME,
  type PurchasableId,
  TIERS,
  VAT_NOTE,
  getTier,
  keepingFor,
} from "@/lib/tiers";
import { formatBytes } from "@/utils/format";

export function UpgradePanel({
  eventId,
  tier,
  keepForever,
  keptYears,
}: {
  eventId: string;
  tier: string;
  keepForever: boolean;
  keptYears: number;
}) {
  const { pending, error, run } = useServerAction();
  const [chosen, setChosen] = useState<PurchasableId | null>(null);

  const working = pending ? chosen : null;

  function buy(product: PurchasableId) {
    setChosen(product);
    run(() => startCheckout(eventId, product), {
      onSuccess: (result) => {
        if (result.url) window.location.href = result.url;
      },
    });
  }

  const options: Array<{ product: PurchasableId; title: string; body: string; price: number }> =
    [];

  const current = getTier(tier);

  if (current.rank < TIERS.plus.rank) {
    options.push({
      product: "plus",
      title: `Move up to ${TIERS.plus.name}`,
      body: `${formatBytes(TIERS.plus.quotaBytes, 0)}, video, a custom event page, and photos kept for six months.`,
      price: TIERS.plus.priceEur,
    });
  }
  if (current.rank < TIERS.pro.rank) {
    options.push({
      product: "pro",
      title: `Move up to ${TIERS.pro.name}`,
      body: `${formatBytes(TIERS.pro.quotaBytes, 0)}, twelve months, video up to ${formatBytes(TIERS.pro.maxFileBytes, 0)} a clip, and the live slideshow.`,
      price: TIERS.pro.priceEur,
    });
  }
  const keeping = keepingFor(current);
  if (keeping && !keptYears) {
    options.push({
      product: keeping.key,
      title: KEEPING_NAME,
      body: `Keep the photos online after the ${current.name} window ends. €${keeping.priceEur} a year, cancel whenever - the first charge is only when the included window runs out.`,
      price: keeping.priceEur,
    });
  }

  if (options.length === 0) {
    return (
      <Panel title="Nothing left to buy">
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ash">
          {keepForever
            ? `This event is on ${TIERS.pro.name} and its photos are kept permanently.`
            : `This event is on ${TIERS.pro.name}, and ${KEEPING_NAME.toLowerCase()} is already running - the photos stay online for as long as it does.`}
        </p>
        {keptYears > 0 && <ManageBilling />}
      </Panel>
    );
  }

  return (
    <Panel title="More room, or more time">
      <p className="mt-2 max-w-prose text-[0.9375rem] text-ash">
        Plans are one payment per event. Upgrading during the night works fine -
        the limit lifts the moment the payment clears. {VAT_NOTE}
      </p>

      <ul className="mt-5 space-y-3">
        {options.map((option) => (
          <li
            key={option.product}
            className="note grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-x-6"
          >
            <div className="min-w-0">
              <div className="flex items-start gap-2.5">
                <Hole size={10} className="mt-2" />
                <h3 className="text-[1.0625rem] font-bold leading-snug">
                  {option.title}
                </h3>
              </div>
              <p className="mt-1.5 max-w-prose text-[0.9375rem] leading-snug text-ash">
                {option.body}
              </p>
            </div>
            <p
              className="shrink-0 font-display text-[1.5rem] font-extrabold tracking-[-0.04em]"
              style={{ fontStretch: "86%" }}
            >
              €{option.price}
            </p>
            <Button
              onClick={() => buy(option.product)}
              disabled={pending}
              size="sm"
              className="col-span-2 w-full sm:col-span-1 sm:w-auto"
            >
              <MdOutlineShoppingCartCheckout aria-hidden className="shrink-0 text-[1.25em]" />
              {working === option.product
                ? "Opening checkout…"
                : `Buy for €${option.price}`}
            </Button>
          </li>
        ))}
      </ul>

      {error && <Alert className="mt-4">{error}</Alert>}

      {keptYears > 0 && <ManageBilling />}

      <RecoverPurchase eventId={eventId} />
    </Panel>
  );
}

function ManageBilling() {
  const { pending, error, run } = useServerAction();

  return (
    <div className="mt-5 border-t border-edge pt-4">
      <Button
        onClick={() =>
          run(() => openBillingPortal(), {
            onSuccess: (result) => {
              if (result.url) window.location.href = result.url;
            },
          })
        }
        disabled={pending}
        variant="secondary"
        size="sm"
      >
        <MdOutlineReceiptLong aria-hidden className="shrink-0 text-[1.25em]" />
        {pending ? "Opening…" : "Renewal date, invoices and cancelling"}
      </Button>
      <p className="mt-2 text-[0.8125rem] leading-snug text-mist">
        Opens your billing with Creem, who take the payment. Cancel there at any
        time - the year you have already paid for always stands.
      </p>
      {error && <Alert className="mt-3">{error}</Alert>}
    </div>
  );
}

function RecoverPurchase({ eventId }: { eventId: string }) {
  const { pending, error, run } = useServerAction();
  const [outcome, setOutcome] = useState<string | null>(null);

  return (
    <div className="mt-6 border-t border-ink/10 pt-4">
      <p className="text-[0.9375rem] text-ash">
        Paid and nothing changed? Payment providers occasionally take a few
        minutes to tell us.
      </p>

      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        className="mt-3"
        onClick={() =>
          run(() => recoverPurchase(eventId), {
            onSuccess: (result) => {
              setOutcome(
                result.applied && result.applied > 0
                  ? "Found it. Your plan is up to date."
                  : "No unclaimed payment found under your email. If you were charged, write to us and we will sort it by hand.",
              );
            },
          })
        }
      >
        <MdOutlineReceiptLong aria-hidden className="shrink-0 text-[1.25em]" />
        {pending ? "Checking with the provider…" : "Find my payment"}
      </Button>

      {outcome && (
        <p className="mt-3 text-[0.9375rem] text-ash" role="status">
          {outcome}
        </p>
      )}
      {error && <Alert className="mt-3">{error}</Alert>}
    </div>
  );
}
