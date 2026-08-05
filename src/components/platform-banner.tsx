import Link from "next/link";

import { LogoMark } from "@/components/logo";

/**
 * The Say Cheese header and footer on a free event.
 *
 * This is the free plan's price. Not a watermark stamped across somebody's
 * photographs - a small bar above and a clear invitation below, on the one page
 * where the audience is a hundred people who have just watched the product work
 * and are holding phones full of their own events.
 *
 * Paid events remove it entirely. That is most of what "custom event page" is
 * actually buying.
 */

export function PlatformHeader() {
  return (
    <div className="border-b-2 border-pepper bg-pepper">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 sm:px-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2"
          target="_blank"
          rel="noopener"
        >
          <LogoMark variant="reversed" className="h-6 w-auto" />
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-butter/70">
            Say Cheese
          </span>
        </Link>
        <Link
          href="/"
          target="_blank"
          rel="noopener"
          className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-gouda underline underline-offset-4"
        >
          Collect photos at your event
        </Link>
      </div>
    </div>
  );
}

export function PlatformFooter() {
  return (
    <section className="border-t-2 border-pepper bg-gouda">
      <div className="mx-auto max-w-3xl px-4 py-9 text-center sm:px-5 sm:py-10">
        <p className="eyebrow text-crust">Made with Say Cheese</p>
        <h2 className="mt-3 text-[1.625rem] sm:text-h2">Having an event of your own?</h2>
        <p className="mx-auto mt-3 max-w-md text-[0.9375rem] leading-relaxed text-crust">
          This is how the host collected every photo here - one code on the
          table, no app and no accounts. Free to set up and try.
        </p>
        <Link
          href="/"
          target="_blank"
          rel="noopener"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-pepper px-6 py-3 font-semibold leading-tight text-butter shadow-[4px_4px_0_var(--color-crust)] transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-7 sm:py-3.5"
        >
          Create your own event
        </Link>
      </div>
    </section>
  );
}
