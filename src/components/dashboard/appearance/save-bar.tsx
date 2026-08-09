"use client";

import type { SaveState } from "@/components/dashboard/appearance/settings";
import { Badge, Button } from "@/components/ui";
import { pluralise } from "@/lib/format";

/**
 * The count and the button.
 *
 * Polite rather than assertive: a screen reader that interrupts the name of
 * the theme you just picked to say "2 changes" is worse than one that waits.
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

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span aria-live="polite" className="flex items-center">
        {changes > 0 ? (
          <Badge tone="gouda">{pluralise(changes, "change")}</Badge>
        ) : (
          <span className="text-[0.8125rem] text-crust">
            {state.status === "saved"
              ? "Saved. Guests see this now."
              : "No changes"}
          </span>
        )}
      </span>

      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={changes === 0 || saving}
      >
        {saving ? "Saving…" : changes === 0 ? "All changes saved" : "Save changes"}
      </Button>
    </div>
  );
}
