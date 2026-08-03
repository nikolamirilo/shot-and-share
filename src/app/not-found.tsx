import Link from "next/link";

import { ButtonLink, Hole } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-butter px-5 text-center">
      <div className="flex items-end gap-3">
        <Hole size={20} />
        <Hole size={38} />
        <Hole size={14} />
      </div>

      <h1 className="mt-9 text-h1">Nothing here.</h1>
      <p className="mt-3 max-w-md text-body text-crust">
        The page has moved, or the address has a typo in it. If you were given a
        link to share photos, check it against the code on the table.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Back to the start</ButtonLink>
        <Link
          href="/dashboard"
          className="self-center font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind underline"
        >
          My events
        </Link>
      </div>
    </div>
  );
}
