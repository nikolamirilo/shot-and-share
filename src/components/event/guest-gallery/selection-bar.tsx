"use client";

import { MdClose, MdOutlineFileDownload } from "react-icons/md";

/**
 * The bar across the bottom while the guest is picking photographs: how many
 * they have, a way out, and the download.
 *
 * Fixed to the bottom of the window and inside the safe area, because on a
 * phone this sits over the home indicator.
 */
export function SelectionBar({
  count,
  downloading,
  error,
  onExit,
  onClear,
  onDownload,
}: {
  count: number;
  downloading: boolean;
  error: string | null;
  onExit: () => void;
  onClear: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-paper shadow-[0_-8px_24px_rgba(0,0,0,0.08)] pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onExit}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink/8 text-ink transition-transform active:scale-95"
          aria-label="Close selection"
          title="Close selection"
        >
          <MdClose aria-hidden className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold leading-tight">
            {count === 0 ? "Tap photos to select" : `${count} selected`}
          </p>
          {count > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[0.8125rem] text-ash underline underline-offset-2"
            >
              Clear
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDownload}
          disabled={count === 0 || downloading}
          className="flex shrink-0 items-center gap-2 rounded-2xl bg-claret px-4 py-3 text-small font-semibold text-chalk shadow-md transition-transform disabled:opacity-45 enabled:active:scale-95"
        >
          <MdOutlineFileDownload aria-hidden className="shrink-0 text-[1.25em]" />
          {downloading ? "Preparing…" : "Download"}
        </button>
      </div>
      {error && (
        <p className="mx-auto max-w-3xl px-4 pb-3 text-[0.8125rem] text-claret sm:px-5">
          {error}
        </p>
      )}
    </div>
  );
}
