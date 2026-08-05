"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createEvent, type ActionState } from "@/app/dashboard/actions";
import { Button, Field, inputClass } from "@/components/ui";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function NewEventForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createEvent,
    {},
  );

  return (
    <form action={formAction} className="card space-y-5 p-5 sm:p-6">
      <Field
        label="Event name"
        htmlFor="name"
        hint="Guests see this on the upload page. “Ana and Marko” works better than “Wedding 2026”."
      >
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          placeholder="Ana and Marko"
          className={inputClass}
        />
      </Field>

      <Field
        label="Date"
        htmlFor="event_date"
        hint="How long photos are kept is counted from this day, not from today."
      >
        <input
          id="event_date"
          name="event_date"
          type="date"
          required
          defaultValue={todayIso()}
          className={inputClass}
        />
      </Field>

      {state.error && (
        <p className="rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem] font-semibold">
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
      {pending ? "Creating…" : "Create an event"}
    </Button>
  );
}
