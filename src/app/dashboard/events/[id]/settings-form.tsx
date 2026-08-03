"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateEventSettings, type ActionState } from "@/app/dashboard/actions";
import { LayoutChooser } from "@/components/gallery";
import { Button, Field, inputClass } from "@/components/ui";
import type { EventRow, MediaQuality } from "@/lib/db/types";

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

      <LayoutChooser name="gallery_layout" defaultValue={event.gallery_layout} />

      <QualityChooser defaultValue={event.media_quality} />

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

/**
 * The one setting in this product that is not reversible, so it says so.
 *
 * "Optimised" re-encodes each photo to roughly a quarter of the size at a
 * resolution nobody can tell apart on a screen, and throws the uploaded file
 * away. For almost every host that is the better trade — it is the difference
 * between a free event holding 250 photos and holding a thousand. For anyone
 * printing large or handing files to an editor, it is the wrong one.
 */
function QualityChooser({ defaultValue }: { defaultValue: MediaQuality }) {
  const options: Array<{
    id: MediaQuality;
    name: string;
    hint: string;
  }> = [
    {
      id: "optimised",
      name: "Optimised",
      hint: "Photos are re-encoded to about a quarter of the size, at a resolution you will not see the difference in on any screen. Four times as many photos fit. The uploaded file is not kept.",
    },
    {
      id: "original",
      name: "Exactly as uploaded",
      hint: "Keep every original byte. Fills up four times faster. Choose this if you will print large, or hand the files to an editor.",
    },
  ];

  return (
    <fieldset>
      <legend className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-rind">
        Photo quality
      </legend>
      <p className="mt-1.5 text-[0.9375rem] text-crust">
        Applies to photos uploaded from now on. Re-encoding cannot be undone, so
        switch before the event rather than after it.
      </p>

      <div className="mt-3 space-y-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-pepper bg-butter p-3 has-[:checked]:bg-gouda"
          >
            <input
              type="radio"
              name="media_quality"
              value={option.id}
              defaultChecked={option.id === defaultValue}
              className="mt-1 h-4 w-4 shrink-0 accent-[#1F1607]"
            />
            <span>
              <span className="block font-bold">{option.name}</span>
              <span className="block text-[0.8125rem] leading-snug text-crust">
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
