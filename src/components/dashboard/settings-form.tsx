"use client";

import { useActionState } from "react";
import { MdOutlineSave } from "react-icons/md";

import { updateEventSettings } from "@/lib/actions/events";
import type { ActionState } from "@/lib/actions/types";
import { SubmitButton } from "@/components/form/submit-button";
import { Alert, Field, cx, inputClass } from "@/components/ui";
import type { EventRow } from "@/lib/db/types";

export function SettingsForm({ event }: { event: EventRow }) {
  const action = updateEventSettings.bind(null, event.id);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="card space-y-5 p-5 sm:p-6">
      <h2 className="text-h3">Settings</h2>

      {/* A name and a date are both short answers. Stacked they make two
          40rem-wide fields on a laptop, which reads as a much longer form than
          this is - so from `sm` they share a line. Below that, unchanged. */}
      <div className="space-y-5 sm:grid sm:grid-cols-2 sm:gap-5 sm:space-y-0">
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
      </div>

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
          className={cx(inputClass, "sm:max-w-2xl")}
        />
      </Field>

      <label className="flex items-start gap-3 sm:max-w-2xl">
        <input
          type="checkbox"
          name="gallery_visible"
          defaultChecked={event.gallery_visible}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#1F1607]"
        />
        <span>
          <span className="block font-semibold">
            Let guests see the shared gallery
          </span>
          <span className="block text-[0.9375rem] text-ash">
            On by default. Guests like seeing the night from other people&apos;s
            phones. Turn it off and the page becomes upload-only.
          </span>
        </span>
      </label>

      {/* No photo-quality choice, deliberately: photos are always stored
        compressed, and the alternative is a setting whose only effect is
        filling the event four times faster for a difference nobody can see. */}

      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="ok">Saved.</Alert>}

      <SubmitButton
        idle="Save settings"
        pending="Saving…"
        icon={<MdOutlineSave aria-hidden className="shrink-0 text-[1.25em]" />}
        className="w-full sm:w-auto"
      />
    </form>
  );
}
