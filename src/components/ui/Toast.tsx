"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { MdClose } from "react-icons/md";

import { cx } from "@/utils/cx";

export function Toast({
  open,
  onClose,
  duration = 4500,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  duration?: number;
  children: ReactNode;
  className?: string;
}) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => close.current(), duration);
    return () => clearTimeout(timer);
  }, [open, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="over-bottom-bar pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
    >
      {open && (
        <div
          className={cx(
            "toast-in pointer-events-auto flex max-w-[min(28rem,100%)] items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-small font-semibold text-chalk shadow-lg",
            className,
          )}
        >
          <span className="min-w-0">{children}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="-mr-1 shrink-0 rounded-full px-2 py-1 text-chalk/70 transition-colors hover:text-chalk"
          >
            <MdClose aria-hidden className="text-[1.25em]" />
          </button>
        </div>
      )}
    </div>
  );
}
