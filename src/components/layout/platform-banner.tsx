"use client";

import { useState } from "react";
import Link from "next/link";
import { MdClose } from "react-icons/md";

import { LogoMark } from "@/components/layout/logo";

/**
 * The Shot & Share plug on a free event - the free plan's price, and a small
 * bar rather than a watermark across somebody's photographs. Paid events
 * remove it, which is most of what "custom event page" buys.
 *
 * It floats over the top of the page rather than sitting in the header or
 * footer, so it never collides with the gallery's own floating controls
 * further down - the "Select" button among them.
 */
export function PlatformBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-ink/10 bg-blush px-4 py-3 shadow-lg">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linen">
          <LogoMark className="h-5 w-auto" />
        </span>
        <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-ash">
          <Link
            href="/"
            target="_blank"
            rel="noopener"
            className="font-semibold text-ink underline underline-offset-2"
          >
            Collect photos at your own event
          </Link>{" "}
          - free, no app.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-ash/70 transition-colors hover:text-ash"
        >
          <MdClose aria-hidden className="text-[1.1em]" />
        </button>
      </div>
    </div>
  );
}
