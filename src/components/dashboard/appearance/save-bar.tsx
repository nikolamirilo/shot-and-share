"use client";

import type { SaveState } from "@/components/dashboard/appearance/settings";
import { Button } from "@/components/ui";
import { pluralise } from "@/lib/format";

/**
 * One floating button, over the panel rather than in it.
 *
 * The panel is several screens tall and the host is looking at the drawing, not
 * at the top of the form, so the button follows them: pinned to the bottom of
 * the window, clear of the tab bar a phone carries down there - see
 * `.over-bottom-bar`.
 *
 * The count is *on* the button rather than beside it. What a host needs to see
 * from the corner of their eye is one claret shape that says how much work is
 * waiting; a label and a separate counter is two things to read and, on a phone,
 * two things to wrap.
 *
 * It exists only while there is something to save. "All changes saved" as a
 * permanently disabled button is a control that is never a control, and the
 * confirmation that a save landed is the toast rather than anything here.
 *
 * `fixed` is safe inside a tab panel: a panel switched away from is `hidden`,
 * and display:none takes its fixed children with it. The button is over the page
 * it belongs to and no other.
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
    <>
      {/* The button is out of the flow, so the end of the panel keeps room for
          it by hand. A phone already reserves the bottom of the page for the tab
          bar and needs almost none of this. */}
      <div aria-hidden className="h-4 sm:h-12" />

      <div className="over-bottom-bar pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 sm:justify-end sm:px-6">
        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          /* Polite rather than assertive: a screen reader that interrupts the
             name of the theme you just picked to say "2 changes" is worse than
             one that waits for a gap. */
          aria-live="polite"
          className="toast-in pointer-events-auto whitespace-nowrap shadow-lg"
        >
          {saving ? "Saving…" : `Save ${pluralise(changes, "change")}`}
        </Button>
      </div>
    </>
  );
}
