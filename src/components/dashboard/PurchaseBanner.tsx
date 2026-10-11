"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Alert } from "@/components/ui";

const ATTEMPTS = 6;
const EVERY_MS = 2500;

const LINGER_DONE_MS = 10_000;
const LINGER_UNRESOLVED_MS = 60_000;

export function PurchaseBanner({
  settled,
  className,
}: {
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
