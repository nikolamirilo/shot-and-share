"use client";

import { MdOutlineSave } from "react-icons/md";

import { type SaveState } from "@/types/appearance";
import { Button } from "@/components/ui";
import { pluralise } from "@/utils/format";

export function SaveBar({
  changes,
  state,
  onSave,
}: {
  changes: number;
  state: SaveState;
  onSave: () => void;
}) {
  const saving = state.status === "saving";
  if (changes === 0 && !saving) return null;

  return (
    <>
      <div aria-hidden className="h-4 sm:h-12" />

      <div className="over-bottom-bar pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 sm:justify-end sm:px-6">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          aria-live="polite"
          className="toast-in pointer-events-auto whitespace-nowrap shadow-lg"
        >
          <MdOutlineSave aria-hidden className="shrink-0 text-[1.25em]" />
          {saving ? "Saving…" : `Save ${pluralise(changes, "change")}`}
        </Button>
      </div>
    </>
  );
}
