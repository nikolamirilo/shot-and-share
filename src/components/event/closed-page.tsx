import Link from "next/link";

import { Hole } from "@/components/ui";

/**
 * What a guest gets when the link does not work: a dead token, a revoked one,
 * or an event that has stopped collecting.
 *
 * It carries the house theme rather than the event's, because at this point
 * there may not be an event to read a theme from - and a guest who has scanned
 * a code off a table needs to know it is the link that is wrong, not their
 * phone.
 */
export function ClosedPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-butter px-5 py-16 text-center">
      <div className="flex gap-3">
        <Hole size={22} />
        <Hole size={34} />
        <Hole size={16} />
      </div>
      <h1 className="mt-8 max-w-lg text-[2.25rem] sm:text-h1">{title}</h1>
      <p className="mt-4 max-w-md text-body text-crust">{body}</p>
      <Link
        href="/"
        className="mt-8 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind underline"
      >
        What is Say Cheese?
      </Link>
    </div>
  );
}
