import Link from "next/link";

import { Hole } from "@/components/ui";

export function ClosedPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-linen px-5 py-16 text-center">
      <div className="flex gap-3">
        <Hole size={22} />
        <Hole size={34} />
        <Hole size={16} />
      </div>
      <h1 className="mt-8 max-w-lg text-[2.25rem] sm:text-h1">{title}</h1>
      <p className="mt-4 max-w-md text-body text-ash">{body}</p>
      <Link
        href="/"
        className="mt-8 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist underline"
      >
        What is Shot & Share?
      </Link>
    </div>
  );
}
