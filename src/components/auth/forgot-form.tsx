"use client";

import { useActionState } from "react";

import { requestReset, type AuthState } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/form/submit-button";
import { Alert, Card, Field, inputClass } from "@/components/ui";

export function ForgotForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestReset,
    {},
  );

  if (state.notice) {
    return (
      <Card pad="roomy">
        <h2 className="text-h3">Check your inbox</h2>
        <p className="mt-3 text-[0.9375rem] text-ash">{state.notice}</p>
      </Card>
    );
  }

  return (
    <form action={formAction} className="card space-y-5 p-5 sm:p-7">
      <Field
        label="Email"
        htmlFor="email"
        hint="We send a link that signs you in long enough to set a new password."
      >
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

      {state.error && <Alert>{state.error}</Alert>}

      <SubmitButton idle="Send the link" pending="Sending…" size="lg" className="w-full" />
    </form>
  );
}
