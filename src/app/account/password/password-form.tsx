"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updatePassword, type AuthState } from "@/app/login/actions";
import { Button, Field, inputClass } from "@/components/ui";
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

      {state.error && (
        <p className="note p-3 text-[0.9375rem] font-semibold">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Saving…" : "Save the password"}
    </Button>
  );
}
