"use client";

import { useActionState } from "react";
import { MdOutlineSave } from "react-icons/md";

import { updateEventSettings } from "@/lib/actions/events";
import type { ActionState } from "@/lib/actions/types";
import { SubmitButton } from "@/components/form/SubmitButton";
import { Alert, Field, cx, inputClass } from "@/components/ui";
import { type EventRow } from "@/types/db";

export function SettingsForm({ event }: { event: EventRow }) {
  const action = updateEventSettings.bind(null, event.id);
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="card space-y-5 p-5 sm:p-6">
      <h2 className="text-h3">Settings</h2>

      <Field label="Event name" htmlFor="name">
        <input
          id="name"
          name="name"
          defaultValue={event.name}
          required
          maxLength={120}
          className={cx(inputClass, "sm:max-w-sm")}
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

      <label className="flex items-start gap-3 sm:max-w-2xl">
        <input
          type="checkbox"
          name="require_approval"
          defaultChecked={event.require_approval}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#1F1607]"
        />
        <span>
          <span className="block font-semibold">
            Check every photo before guests see it
          </span>
          <span className="block text-[0.9375rem] text-ash">
            Off by default. Everything guests upload waits for you under Photos
            instead of appearing straight away. Sensible for a company event,
            hard work at a wedding. If the automatic scan below is on,
            anything it flags waits for you whether this is on or not.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 sm:max-w-2xl">
        <input
          type="checkbox"
          name="auto_scan"
          defaultChecked={event.auto_scan}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#1F1607]"
        />
        <span>
          <span className="block font-semibold">
            Automatic scan of content
          </span>
          <span className="block text-[0.9375rem] text-ash">
            Off by default. Each photo is checked automatically as it arrives
            and anything it flags waits for you under Photos, instead of
            appearing straight away. The check reads the photo in the same
            region it is stored in and returns category labels only. Leave it
            off and nothing is sent anywhere - your own controls and the report
            button still work either way.
          </span>
        </span>
      </label>

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
