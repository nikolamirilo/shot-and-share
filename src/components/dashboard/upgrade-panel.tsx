"use client";

import { MdOutlineReceiptLong, MdOutlineShoppingCartCheckout } from "react-icons/md";

import { useServerAction } from "@/hooks/use-server-action";

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
  getTier,
  keepingFor,
} from "@/lib/tiers";
import { formatBytes } from "@/lib/format";

export function UpgradePanel({
  eventId,
  tier,
  keepForever,
  keptYears,
}: {
  eventId: string;
  /** The variant id off the event row, not a plan key. */
  tier: string;
  /** Legacy Keep Forever, still honoured where somebody bought one. */
  keepForever: boolean;
  /** Years of keeping already paid for. Non-zero means a subscription runs. */
  keptYears: number;
}) {
  const { pending, error, run } = useServerAction();
  const [chosen, setChosen] = useState<PurchasableId | null>(null);

  /**
   * Which button is actually working, rather than all of them.
   *
   * Read through `pending` rather than cleared afterwards: the moment the
   * action settles every button goes back to its price, so a failure leaves no
   * row stuck on "Opening checkout…" and a success - which navigates away -
   * never flickers back to the price on the way out.
   */
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
  /*
   * Keeping is only offered on a paid plan, and only when one is not already
   * running. A free event has nothing to extend - its host buys a plan first,
   * which is why the Free branch here is a tier upgrade rather than a
   * subscription.
   */
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
        the limit lifts the moment the payment clears.
      </p>

      {/* One offer, one row. On a phone the price sits against the title and
          the button takes the width underneath it, which is what the two
          columns and the spanning third cell say. A third column from `sm`
          picks the button up onto the same line - the offer is then read left
          to right and ends where you buy it, and nothing here is a 50rem-wide
          "Buy for €29". */}
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

/**
 * Where a subscription is cancelled.
 *
 * Keeping the photos is the only recurring charge in this product, and a
 * recurring charge with no visible way out of it is not a missing feature - EU
 * consumer rules require cancelling to be as easy as subscribing, and a host
 * who cannot find the exit opens a dispute with their bank instead of a ticket
 * with us.
 *
 * It opens Creem's own portal rather than a page of ours. Creem holds the card,
 * the invoices and the renewal date; mirroring any of that here to render it
 * would be a second source of truth about somebody's money, and a stale one.
 *
 * Only shown when something is actually running - `keptYears > 0`. A host with
 * nothing recurring has nothing to manage, and a billing link on that panel
 * reads as though they are being charged for something.
 */
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

/**
 * The way out for somebody who has paid and is looking at a plan that did not
 * change.
 *
 * Entitlement is granted by the provider's signed webhook and by nothing else,
 * which is right, and which means a webhook that is slow or lost leaves a
 * paying customer stuck. That customer opens a ticket, and if the ticket sits
 * for a day they open a dispute with their bank instead - the chargeback a
 * payment reviewer is trying to predict when they look at one-time purchases.
 *
 * Quiet and always present rather than appearing after a failure, because the
 * person who needs it is already annoyed and should not have to find it.
 */
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
