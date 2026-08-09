"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestReset, type AuthState } from "@/app/login/actions";
import { Button, Field, inputClass } from "@/components/ui";

export function ForgotForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestReset,
    {},
  );

  if (state.notice) {
    return (
      <div className="card p-5 sm:p-7">
        <h2 className="text-h3">Check your inbox</h2>
        <p className="mt-3 text-[0.9375rem] text-crust">{state.notice}</p>
      </div>
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
      {pending ? "Sending…" : "Send the link"}
    </Button>
  );
}
