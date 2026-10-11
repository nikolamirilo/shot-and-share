"use client";

import { useState, useTransition } from "react";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

/**
 * Nothing is caught: a server action that redirects does so by throwing, and swallowing
 * that turns "delete this event" into a button that does nothing.
 */
export function useServerAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run<T extends ActionResult>(
    action: () => Promise<T>,
    options?: {
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
