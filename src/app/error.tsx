"use client";

import { useEffect } from "react";

import { Button, ButtonLink, Hole } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-butter px-5 text-center">
      <div className="flex items-end gap-3">
        <Hole size={16} />
        <Hole size={30} />
        <Hole size={22} />
      </div>

      <h1 className="mt-9 text-h1">That did not work.</h1>
      <p className="mt-3 max-w-md text-body text-crust">
        Something broke on our side. Nothing you have uploaded is affected -
        photos are stored the moment they arrive, not when the page finishes
        loading.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </div>

      {error.digest && (
        <p className="mt-8 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
