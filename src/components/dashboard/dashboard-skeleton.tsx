import { cx } from "@/components/ui";

/**
 * What the dashboard looks like while the server is still answering.
 *
 * Both pages under the shell wait on the database before they can draw
 * anything, and without a loading state the tap that asked for them did
 * nothing at all until they arrived - which reads as a broken link. These are
 * drawn from `loading.tsx`, so the page changes the moment the link is pressed
 * and the real one streams in over the top.
 */

const BLOCK = "animate-pulse rounded-md bg-ink/8";

function Bar({ className }: { className?: string }) {
  return <span aria-hidden className={cx("block", BLOCK, className)} />;
}

/** The list of events: a heading and a few cards. */
export function EventsSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-8 sm:px-5 sm:py-10"
      aria-busy="true"
      aria-label="Loading your events"
    >
      <Bar className="h-3 w-24" />
      <Bar className="mt-4 h-10 w-48" />
      <ul className="mt-7 grid grid-cols-1 gap-4 sm:mt-9 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="card flex flex-col p-5">
            <Bar className="h-6 w-2/3" />
            <Bar className="mt-2 h-3 w-1/3" />
            <Bar className="mt-6 h-4 w-1/2" />
            <Bar className="mt-5 h-2 w-full" />
            <Bar className="mt-3 h-3 w-2/5" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One event's console: the way back, the title, the stats and a panel. */
export function EventConsoleSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-5 sm:py-10 sm:pb-10"
      aria-busy="true"
      aria-label="Loading the event"
    >
      <Bar className="h-9 w-32 rounded-full" />
      <Bar className="mt-8 h-3 w-28" />
      <Bar className="mt-4 h-10 w-3/5" />
      <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Bar key={i} className="h-20" />
        ))}
      </div>
      <Bar className="mt-8 h-11 w-full rounded-full" />
      <div className="card mt-6 p-5">
        <Bar className="h-5 w-40" />
        <Bar className="mt-4 h-48 w-full" />
      </div>
    </div>
  );
}
