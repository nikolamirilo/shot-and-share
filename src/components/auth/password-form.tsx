"use client";

import { useActionState } from "react";
import { MdOutlineLockReset } from "react-icons/md";

import { updatePassword, type AuthState } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/form/submit-button";
import { Alert, Field, inputClass } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

export function PasswordForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    updatePassword,
    {},
  );

  return (
    <form action={formAction} className="card space-y-5 p-5 sm:p-7">
      <Field
        label="New password"
        htmlFor="password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      >
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <Field label="New password again" htmlFor="confirm">
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      {state.error && <Alert>{state.error}</Alert>}

      <SubmitButton
        idle="Save the password"
        pending="Saving…"
        icon={<MdOutlineLockReset aria-hidden className="shrink-0 text-[1.25em]" />}
        size="lg"
        className="w-full"
      />
    </form>
  );
}
