"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

export function LoginPanel({
  next,
  error,
  configured,
}: {
  next?: string;
  error?: string;
  configured: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(error ?? null);

  async function signIn() {
    setPending(true);
    setFailure(null);
    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      if (next) redirectTo.searchParams.set("next", next);

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo.toString() },
      });
      if (authError) throw authError;
    } catch (e) {
      setPending(false);
      setFailure(
        e instanceof Error ? e.message : "Could not start sign-in. Try again.",
      );
    }
  }

  if (!configured) {
    return (
      <div className="card p-7">
        <h2 className="text-h3">Supabase is not configured</h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-crust">
          Set <code className="font-mono text-[0.9375rem]">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="font-mono text-[0.9375rem]">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          and{" "}
          <code className="font-mono text-[0.9375rem]">SUPABASE_SECRET_KEY</code>{" "}
          in <code className="font-mono text-[0.9375rem]">.env.local</code>, run
          the migrations in{" "}
          <code className="font-mono text-[0.9375rem]">supabase/migrations</code>
          , then enable the Google provider in Supabase Auth.
        </p>
        <p className="mt-3 text-[0.9375rem] text-crust">
          Full steps are in the README.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-7">
      <h2 className="text-h3">Continue with Google</h2>
      <p className="mt-2 text-[0.9375rem] text-crust">
        One click. We ask Google for your name and email address, nothing else.
      </p>

      <Button
        onClick={signIn}
        disabled={pending}
        size="lg"
        className="mt-6 w-full"
      >
        {pending ? "Opening Google…" : "Sign in with Google"}
      </Button>

      {failure && (
        <p className="mt-4 rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem]">
          {failure}
        </p>
      )}

      <p className="mt-6 text-[0.8125rem] leading-relaxed text-rind">
        By signing in you agree to the terms and the privacy notice. We never
        look at your photos, and you can delete an event and everything in it at
        any time.
      </p>
    </div>
  );
}
