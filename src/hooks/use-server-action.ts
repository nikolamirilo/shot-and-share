"use client";

import { useState, useTransition } from "react";

/** What every server action in the product resolves to. */
export interface ActionResult {
  error?: string;
  ok?: boolean;
}

/**
 * Calling a server action from a button, with the pending flag and the error it
 * may come back with.
 *
 * Four panels each hand-rolled this, and they had drifted on the one question
 * that matters: when the error clears. One cleared it on the next call, one
 * cleared it up front, and two never cleared it at all - so a failure followed
 * by a success left the old message sitting under a panel that had just worked.
 * Clearing up front is the answer, and having it in one place is what stops the
 * next panel picking a fifth one.
 *
 * Nothing is caught. A server action that redirects does so by throwing, and
 * swallowing that would turn "delete this event" into a button that appears to
 * do nothing.
 */
export function useServerAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run<T extends ActionResult>(
    action: () => Promise<T>,
    options?: {
      /** Asked before anything runs. Answering no is not an error. */
      confirm?: string;
      onSuccess?: (result: T) => void;
    },
  ) {
    if (options?.confirm && !window.confirm(options.confirm)) return;
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        return;
      }
      options?.onSuccess?.(result);
    });
  }

  return { pending, error, setError, run };
}
