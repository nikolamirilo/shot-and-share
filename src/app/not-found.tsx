import Link from "next/link";

import { ButtonLink, Hole } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-linen px-5 py-16 text-center">
      <div className="flex items-end gap-3">
        <Hole size={20} />
        <Hole size={38} />
        <Hole size={14} />
      </div>

      <h1 className="mt-9 text-[2.25rem] sm:text-h1">Nothing here.</h1>
      <p className="mt-3 max-w-md text-body text-ash">
        The page has moved, or the address has a typo in it. If you were given a
        link to share photos, check it against the code on the table.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col items-center justify-center gap-4 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-3">
        <ButtonLink href="/" className="w-full sm:w-auto">
          Back to the start
        </ButtonLink>
        <Link
          href="/dashboard"
          className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist underline"
        >
          My events
        </Link>
      </div>
    </div>
  );
}
