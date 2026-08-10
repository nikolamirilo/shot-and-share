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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-linen px-5 py-16 text-center">
      <div className="flex items-end gap-3">
        <Hole size={16} />
        <Hole size={30} />
        <Hole size={22} />
      </div>

      <h1 className="mt-9 text-[2.25rem] sm:text-h1">That did not work.</h1>
      <p className="mt-3 max-w-md text-body text-ash">
        Something broke on our side. Nothing you have uploaded is affected -
        photos are stored the moment they arrive, not when the page finishes
        loading.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap">
        <Button onClick={reset} className="w-full sm:w-auto">
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary" className="w-full sm:w-auto">
          Back to the start
        </ButtonLink>
      </div>

      {error.digest && (
        <p className="mt-8 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
