"use client";

import { useEffect, useState } from "react";

import { type SaveState, type Settings } from "@/types/appearance";
import { countChanges, draftKey, fromEvent, readDraft, toFields, writeDraft } from "@/utils/appearance-settings";
import { updateAppearance } from "@/lib/actions/appearance";
import { type EventRow } from "@/types/db";

export function useAppearanceDraft(event: EventRow) {
  const initial = fromEvent(event);
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [ready, setReady] = useState(false);

  const key = draftKey(event.id);
  const changes = countChanges(settings, saved);

  useEffect(() => {
    const draft = readDraft(key);
    if (draft) setSettings(draft);
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    writeDraft(key, settings, saved);
  }, [ready, key, settings, saved]);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    setState({ status: "idle" });
  }

  async function save() {
    const sent = settings;
    setState({ status: "saving" });

    const body = new FormData();
    for (const [name, value] of Object.entries(toFields(sent))) {
      body.set(name, value);
    }

    const result = await updateAppearance(event.id, {}, body).catch(() => ({
      error: "That did not save. Check your connection and try again.",
    }));

    if (result.error) {
      setState({ status: "idle", error: result.error });
      return;
    }

    setSaved(sent);
    setState({ status: "saved" });
  }

  return { settings, update, changes, save, state };
}
