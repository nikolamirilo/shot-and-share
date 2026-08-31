"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Alert } from "@/components/ui";

/**
 * How long the page waits for a payment to land before it stops asking.
 *
 * Six tries at two and a half seconds is fifteen seconds of patience, which
 * comfortably covers the usual case - the webhook is normally already here by
 * the time the browser is - without leaving a tab quietly polling all evening
 * because a delivery was genuinely lost.
 */
const ATTEMPTS = 6;
const EVERY_MS = 2500;

/**
 * How long a finished banner stays before it takes itself off the page.
 *
 * Two durations because the two endings are different kinds of message. "It
 * worked" is news and is read once; "this needs you to do something" is an
 * instruction, and pulling an instruction off the screen ten seconds after
 * writing it is how a host ends up stuck with no idea what they were told.
 */
const LINGER_DONE_MS = 10_000;
const LINGER_UNRESOLVED_MS = 60_000;

/**
 * What the host sees on the way back from checkout.
 *
 * The old banner said the same thing whether or not the plan had moved - wait a
 * few seconds and reload - and then stayed there for good, because it is drawn
 * from `?purchase=complete` and nothing ever took that off the URL. So it read
 * as a warning to the majority whose upgrade had already worked, and it read as
 * a warning permanently.
 *
 * This does the waiting itself and then clears up after itself. Each refresh
 * re-runs the server component, which is also what re-runs recovery against the
 * payment provider - so the wait is not merely looking again, it is the same
 * "I paid and nothing happened" check the button under Plan does, run
 * automatically while the host watches.
 */
export function PurchaseBanner({
  settled,
  className,
}: {
  /**
   * Whether the thing that was paid for is now in effect on this event, or
   * null where the URL does not say what was bought and there is no way to
   * tell - a checkout link issued before it started naming the product.
   */
  settled: boolean | null;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tries, setTries] = useState(0);

  const waiting = settled === false && tries < ATTEMPTS;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, EVERY_MS);
    return () => clearTimeout(timer);
  }, [waiting, tries, router]);

  /*
   * Then take the checkout parameters back off the URL, which is what actually
   * dismisses this - the banner exists because they are there.
   *
   * Worth doing beyond tidiness: while `purchase=complete` is on the URL every
   * single load of this page makes outbound calls to the payment provider
   * looking for an order that was applied long ago.
   *
   * `scroll: false` because this fires while the host is reading something
   * further down the page, and a banner disappearing should not also throw them
   * back to the top.
   */
  useEffect(() => {
    if (waiting) return;
    const timer = setTimeout(
      () => router.replace(pathname, { scroll: false }),
      settled ? LINGER_DONE_MS : LINGER_UNRESOLVED_MS,
    );
    return () => clearTimeout(timer);
  }, [waiting, settled, pathname, router]);

  if (settled) {
    return (
      <Alert tone="notice" className={className}>
        Payment received and this event has been upgraded. Nothing else to do -
        the new limits are live already.
      </Alert>
    );
  }

  if (waiting) {
    return (
      <Alert tone="notice" className={className}>
        Payment received. Applying it to this event now - this page will update
        itself the moment it lands, so there is no need to reload.
      </Alert>
    );
  }

  if (settled === null) {
    return (
      <Alert tone="notice" className={className}>
        Payment received. If the plan still looks the same, wait a few seconds
        and reload - and if it still has not moved, use{" "}
        <strong>Find my payment</strong> under Plan. Nothing is lost either way.
      </Alert>
    );
  }

  return (
    <Alert tone="notice" className={className}>
      Payment received, but the plan on this event has not moved yet. Use{" "}
      <strong>Find my payment</strong> under Plan, and write to us if that
      finds nothing. Nothing is lost either way.
    </Alert>
  );
}
