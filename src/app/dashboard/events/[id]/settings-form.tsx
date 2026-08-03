"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateEventSettings, type ActionState } from "@/app/dashboard/actions";
import { Button, Field, inputClass } from "@/components/ui";
import type { EventRow } from "@/lib/db/types";

export function SettingsForm({ event }: { event: EventRow }) {
  const action = updateEventSettings.bind(null, event.id);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="card space-y-5 p-6">
      <h2 className="text-h3">Settings</h2>

      <Field label="Event name" htmlFor="name">
        <input
          id="name"
          name="name"
          defaultValue={event.name}
          required
          maxLength={120}
          className={inputClass}
        />
      </Field>

      <Field
        label="Date"
        htmlFor="event_date"
        hint="Moving the date moves the expiry with it."
      >
        <input
          id="event_date"
          name="event_date"
          type="date"
          defaultValue={event.event_date}
          required
          className={inputClass}
        />
      </Field>

      <Field
        label="Message for guests"
        htmlFor="welcome_message"
        hint="Shown above the upload button. Optional."
      >
        <textarea
          id="welcome_message"
          name="welcome_message"
          rows={3}
          maxLength={400}
          defaultValue={event.welcome_message ?? ""}
          placeholder="Thank you for coming. Please add anything you took tonight."
          className={inputClass}
        />
      </Field>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="gallery_visible"
          defaultChecked={event.gallery_visible}
          className="mt-1 h-5 w-5 shrink-0 accent-[#1F1607]"
        />
        <span>
          <span className="block font-semibold">
            Let guests see the shared gallery
          </span>
          <span className="block text-[0.9375rem] text-crust">
            On by default. Guests like seeing the night from other people&apos;s
            phones. Turn it off and the page becomes upload-only.
          </span>
        </span>
      </label>

      {state.error && (
        <p className="rounded-xl border-2 border-pepper bg-butter p-3 text-[0.9375rem] font-semibold">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-xl border-2 border-pepper bg-gouda p-3 text-[0.9375rem]">
          Saved.
        </p>
      )}

      <Save />
    </form>
  );
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save settings"}
    </Button>
  );
}
