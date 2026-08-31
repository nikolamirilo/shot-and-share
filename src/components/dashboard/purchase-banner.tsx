"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
 * What the host sees on the way back from checkout.
 *
 * The old banner said the same thing whether or not the plan had moved: wait a
 * few seconds and reload. That is a chore we can do ourselves, and it reads as
 * a warning to the majority whose upgrade already worked.
 *
 * So the page re-asks itself instead. Each refresh re-runs the server component,
 * which is also what re-runs recovery against the payment provider - so this is
 * not merely looking again, it is the same "I paid and nothing happened" check
 * the button under Plan does, run automatically while the host watches.
 */
export function PurchaseBanner({
  settled,
  className,
}: {
  /** Whether the thing that was paid for is now in effect on this event. */
  settled: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [tries, setTries] = useState(0);

  const waiting = !settled && tries < ATTEMPTS;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, EVERY_MS);
    return () => clearTimeout(timer);
  }, [waiting, tries, router]);

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

  return (
    <Alert tone="notice" className={className}>
      Payment received, but the plan on this event has not moved yet. Use{" "}
      <strong>Find my payment</strong> under Plan, and write to us if that
      finds nothing. Nothing is lost either way.
    </Alert>
  );
}
