"use client";

import { useState } from "react";

import { EmailForm } from "@/components/auth/EmailForm";
import { Alert, Button, Card } from "@/components/ui";
import {
  tabButtonClass,
  tablistClass,
  type TabShape,
} from "@/components/ui/tabs/styles";
import { createClient } from "@/lib/supabase/browser";
import { FcGoogle } from "react-icons/fc";

/** The segmented control the dashboard uses, borrowed for two options. */
const SWITCH: TabShape = {
  rail: false,
  segmented: true,
  bar: false,
  sticky: false,
};

export function LoginPanel({
  next,
  error,
  configured,
  mode = "signin",
}: {
  next?: string;
  error?: string;
  configured: boolean;
  mode?: "signin" | "signup";
}) {
  const [creating, setCreating] = useState(mode === "signup");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(error ?? null);

  async function signInWithGoogle() {
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
      <Card pad="roomy">
        <h2 className="text-h3">Supabase is not configured</h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ash">
          Set <code className="break-all font-mono text-[0.9375rem]">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="break-all font-mono text-[0.9375rem]">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>{" "}
          and{" "}
          <code className="break-all font-mono text-[0.9375rem]">SUPABASE_SECRET_KEY</code>{" "}
          in <code className="break-all font-mono text-[0.9375rem]">.env.local</code>, run
          the migrations in{" "}
          <code className="break-all font-mono text-[0.9375rem]">supabase/migrations</code>
          , then enable the Email and Google providers in Supabase Auth.
        </p>
        <p className="mt-3 text-[0.9375rem] text-ash">
          Full steps are in the README.
        </p>
      </Card>
    );
  }

  return (
    <Card pad="roomy">
      <h1 className="text-h3">{creating ? "Create your account" : "Sign in"}</h1>
      <p className="mt-2 text-[0.9375rem] text-ash">
        Use an email address and password, or continue with Google.
      </p>

      {/* Both sides of the same panel, so a host who landed on the wrong one
          switches instead of going looking for another page. */}
      <div className="mt-5" role="group" aria-label="Sign in or create an account">
        <div className={tablistClass(SWITCH)}>
          {([
            ["signin", "Sign in"],
            ["signup", "Create account"],
          ] as const).map(([key, label]) => {
            const selected = (key === "signup") === creating;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => setCreating(key === "signup")}
                className={tabButtonClass(SWITCH, {
                  selected,
                  raised: false,
                  order: false,
                })}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <EmailForm next={next} creating={creating} />
      </div>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-0.5 flex-1 bg-ink/20" />
        <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-mist">
          or
        </span>
        <span className="h-0.5 flex-1 bg-ink/20" />
      </div>

      <Button
        onClick={signInWithGoogle}
        disabled={pending}
        variant="secondary"
        size="lg"
        className="w-full"
      >
        <FcGoogle size={26} className="mr-1" />
        {pending ? "Opening Google…" : "Continue with Google"}
      </Button>

      {failure && <Alert className="mt-4">{failure}</Alert>}

      <p className="mt-6 text-[0.8125rem] leading-relaxed text-mist">
        By signing in you agree to the terms and the privacy notice. We never
        look at your photos, and you can delete an event and everything in it at
        any time.
      </p>
    </Card>
  );
}
