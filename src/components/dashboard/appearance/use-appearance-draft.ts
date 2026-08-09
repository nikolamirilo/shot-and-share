"use client";

import { useEffect, useState } from "react";

import {
  type SaveState,
  type Settings,
  countChanges,
  draftKey,
  fromEvent,
  readDraft,
  toFields,
  writeDraft,
} from "@/components/dashboard/appearance/settings";
import { updateAppearance } from "@/lib/actions/appearance";
import type { EventRow } from "@/lib/db/types";

/**
 * The edits, the count of them, and the one write that clears it.
 *
 * This panel used to write every change by itself, a beat after it was made.
 * Six groups behind tabs is a lot of page to be saving silently: a host had no
 * way to tell a colour they had settled on from one they were still trying,
 * and no way to back out of either. Nothing reaches the database now until the
 * button is pressed, and the number beside it says how much is waiting.
 *
 * What a button costs is that a closed tab would lose the work, so the pending
 * edits live in local storage under the event's own key and are read back on
 * the way in. A successful save is the only thing that clears them: until then
 * the draft is what the host sees, and the row is only the baseline it is
 * measured against.
 */
export function useAppearanceDraft(event: EventRow) {
  const initial = fromEvent(event);
  const [settings, setSettings] = useState(initial);
  // What the database is known to hold. Only a save moves it.
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  // Local storage cannot be read while rendering on the server, so the first
  // paint is the row and the draft lands immediately after it.
  const [ready, setReady] = useState(false);

  const key = draftKey(event.id);
  const changes = countChanges(settings, saved);

  useEffect(() => {
    const draft = readDraft(key);
    if (draft) setSettings(draft);
    setReady(true);
  }, [key]);

  // `ready` is a piece of state rather than a ref because it is set in the
  // same batch as the restored draft above: the first run of this effect
  // already has that draft in hand. A ref would let this run once beforehand
  // and write the row back over a draft nothing had read yet.
  useEffect(() => {
    if (!ready) return;
    writeDraft(key, settings, saved);
  }, [ready, key, settings, saved]);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    // A fresh edit clears both "Saved" and the last attempt's error: neither
    // is true of what is on the screen any more.
    setState({ status: "idle" });
  }

  async function save() {
    const sent = settings;
    setState({ status: "saving" });

    const body = new FormData();
    for (const [name, value] of Object.entries(toFields(sent))) {
      body.set(name, value);
    }

    // A rejected action is a lost tunnel or a signed-out session. The draft is
    // left exactly as it is, so the host presses the button again rather than
    // rebuilding their page from memory.
    const result = await updateAppearance(event.id, {}, body).catch(() => ({
      error: "That did not save. Check your connection and try again.",
    }));

    if (result.error) {
      setState({ status: "idle", error: result.error });
      return;
    }

    // What was sent, not what is on screen: a host who kept clicking while the
    // write was in flight still has those later clicks counted as waiting.
    setSaved(sent);
    setState({ status: "saved" });
  }

  return { settings, update, changes, save, state };
}
