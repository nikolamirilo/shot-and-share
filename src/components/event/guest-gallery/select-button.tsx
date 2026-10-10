"use client";

import { MdChecklist } from "react-icons/md";

/** The way into selection mode, floating over the bottom of the wall. */
export function SelectButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-ink/10 bg-blush px-5 py-3.5 text-small font-semibold text-ink shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:shadow-md"
      aria-label="Select photos to download"
    >
      <MdChecklist aria-hidden className="shrink-0 text-[1.25em]" />
      Select
    </button>
  );
}
