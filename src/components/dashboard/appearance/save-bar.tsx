"use client";

import type { SaveState } from "@/components/dashboard/appearance/settings";
import { Button } from "@/components/ui";
import { pluralise } from "@/lib/format";

/**
 * The count and the button, following the host down the panel.
 *
 * It is the last thing in the card and sticky against the bottom of the screen,
 * so it is in reach from every group without being a bar bolted across the page
 * the whole time: the panel is taller than a phone, and a save button at the top
 * of it is a save button nobody can see while they are choosing a font.
 *
 * It exists only while there is something to save. "All changes saved" as a
 * permanently disabled button is a control that is never a control, and the
 * confirmation that a save landed is the toast rather than anything here.
 *
 * Polite rather than assertive: a screen reader that interrupts the name of the
 * theme you just picked to say "2 changes" is worse than one that waits.
 */
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
    <div className="pointer-events-none sticky bottom-0 z-30 -mx-1 mt-6 flex justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="pointer-events-auto toast-in flex items-center gap-3 rounded-2xl bg-paper/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
        {/* Short on purpose: the bar sits on a phone screen too, and a sentence
            here is a sentence wrapped over two lines beside a wrapped button. */}
        <span
          aria-live="polite"
          className="whitespace-nowrap pl-1 text-[0.8125rem] text-ash"
        >
          {saving ? "Saving…" : `${pluralise(changes, "change")} waiting`}
        </span>

        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="whitespace-nowrap"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
