"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Yes, delete",
  cancelLabel = "No, keep it",
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] items-center justify-center overscroll-contain bg-ink/92 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="card w-full max-w-sm p-5 shadow-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-h3">{title}</h3>
        {body && (
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ash">
            {body}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row-reverse">
          <Button
            type="button"
            autoFocus
            disabled={pending}
            onClick={onConfirm}
            className="sm:flex-1"
          >
            {pending ? "Deleting…" : confirmLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onCancel}
            className="sm:flex-1"
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
