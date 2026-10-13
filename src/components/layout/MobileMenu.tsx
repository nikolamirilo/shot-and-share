"use client";

import { useEffect, useRef, useState } from "react";
import { MdClose, MdMenu } from "react-icons/md";

import { cx } from "@/components/ui";

export type MobileMenuItem = {
  key: string;
  render: (close: () => void) => React.ReactNode;
  className?: string;
};

export function MobileMenu({
  items,
  className,
  defaultOpen = false,
}: {
  items: MobileMenuItem[];
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <div className={cx("flex items-center justify-end", className)}>
        {items[0].render(() => {})}
      </div>
    );
  }

  return (
    /*
     * Deliberately not `relative`: the panel is measured against the *bar*, which
     * every caller positions - see HeaderShell.
     */
    <div ref={wrapRef} className={cx("flex items-center", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="mobile-menu-panel"
        className="-mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-blush"
      >
        {open ? <MdClose /> : <MdMenu />}
      </button>

      {open && (
        <div
          id="mobile-menu-panel"
          /*
           * The bar is the containing block - see HeaderShell - so `inset-x-0` lands
           * on its edges and the panel always matches the bar's width.
           */
          className="absolute inset-x-0 top-full z-50 mt-2 flex flex-col items-end gap-1 rounded-2xl bg-paper px-4 py-4 text-right shadow-md"
        >
          {items.map((item) => (
            <div
              key={item.key}
              className={cx("flex w-full justify-end", item.className)}
            >
              {item.render(() => setOpen(false))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
