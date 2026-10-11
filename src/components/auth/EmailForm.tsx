"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { MdOutlineLogin, MdOutlinePersonAddAlt } from "react-icons/md";

import { signIn, signUp, type AuthState } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/form/SubmitButton";
import { Alert, Field, inputClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

export function EmailForm({ next }: { next?: string }) {
  const [creating, setCreating] = useState(false);
  const [signInState, signInAction] = useActionState<AuthState, FormData>(
    signIn,
    {},
  );
  const [signUpState, signUpAction] = useActionState<AuthState, FormData>(
    signUp,
    {},
  );

  const state = creating ? signUpState : signInState;

  if (signUpState.notice) {
    return (
      <div className="note p-4">
        <p className="text-small font-semibold">{signUpState.notice}</p>
        <p className="mt-2 text-small text-ash">
          Nothing there after a minute? Check the spam folder.
        </p>
      </div>
    );
  }

  return (
    <form
      action={creating ? signUpAction : signInAction}
      className="space-y-4"
      key={creating ? "signup" : "signin"}
    >
      {next && <input type="hidden" name="next" value={next} />}

      {creating && (
        <Field label="Name" htmlFor="full_name" hint="Optional.">
          <input
            id="full_name"
            name="full_name"
            maxLength={120}
            autoComplete="name"
            placeholder="Ana Marić"
            className={inputClass}
          />
        </Field>
      )}

      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint={
          creating ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined
        }
      >
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={creating ? MIN_PASSWORD_LENGTH : undefined}
          autoComplete={creating ? "new-password" : "current-password"}
          className={inputClass}
        />
      </Field>

      {state.error && <Alert>{state.error}</Alert>}

      <SubmitButton
        idle={creating ? "Create account" : "Sign in"}
        pending={creating ? "Creating…" : "Signing in…"}
        icon={
          creating ? (
            <MdOutlinePersonAddAlt aria-hidden className="shrink-0 text-[1.25em]" />
          ) : (
            <MdOutlineLogin aria-hidden className="shrink-0 text-[1.25em]" />
          )
        }
        size="lg"
        className="w-full"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-small">
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          className="font-semibold underline decoration-2 decoration-mist underline-offset-4 hover:decoration-ink"
        >
          {creating ? "I already have an account" : "Create an account"}
        </button>

        {!creating && (
          <Link
            href="/login/forgot"
            className="text-ash underline decoration-2 decoration-mist underline-offset-4 hover:decoration-ink"
          >
            Forgot password?
          </Link>
        )}
      </div>
    </form>
  );
}
