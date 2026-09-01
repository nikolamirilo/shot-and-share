"use client";

import { useEffect, useRef, useState } from "react";
import { MdClose, MdMenu } from "react-icons/md";

import { cx } from "@/components/ui";

/**
 * One thing the bar folds away on a phone.
 *
 * `render` is given a `close`, so an item that navigates can shut the menu
 * behind it while one that opens something of its own - the account badge -
 * can leave it be.
 */
export type MobileMenuItem = {
  key: string;
  render: (close: () => void) => React.ReactNode;
  /** Extra classes for the item's row in the panel, e.g. a divider. */
  className?: string;
};

/**
 * The hamburger and the panel it opens, shared by every header.
 *
 * Two rules, and they are the whole component:
 *
 * 1. Everything in `items` lives *inside* the menu. A bar that keeps one
 *    button beside the hamburger makes the reader look in two places for the
 *    same kind of thing.
 * 2. A menu holding one item is a tap in front of that item, so at one item
 *    there is no hamburger at all - the item itself goes on the bar.
 *
 * The panel hangs off the button's right edge, because that is where the
 * button is: a left-aligned list under a right-hand hamburger reads as
 * belonging to something else.
 */
export function MobileMenu({
  items,
  className,
  defaultOpen = false,
}: {
  items: MobileMenuItem[];
  className?: string;
  /** The state the menu starts in. Only a preview or a test asks for `true`. */
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
      // Escape gives the focus back to what opened the panel, not to the page.
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

  /* Rule 2. `close` is a no-op here: there is nothing open to close. */
  if (items.length === 1) {
    return (
      <div className={cx("flex items-center justify-end", className)}>
        {items[0].render(() => {})}
      </div>
    );
  }

  return (
    /* `relative` is what `top-full` on the panel resolves against, so the menu
       lands under the button rather than one screenful down the page. */
    <div ref={wrapRef} className={cx("relative flex items-center", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="mobile-menu-panel"
        /* 44px of tap target, pulled half a step into the pill's own padding so
           the icon still sits on the same optical edge as the wordmark. */
        className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-blush"
      >
        {open ? <MdClose /> : <MdMenu />}
      </button>

      {open && (
        <div
          id="mobile-menu-panel"
          /* As wide as the bar it hangs under: the header's own gutter is
             `px-4`, so the pill is `100vw - 2rem` across, and the negative
             offsets take back the button's `-mr-1` and the pill's padding to
             land the panel's right edge on the pill's. They change at `xs`
             because the pill's padding does. */
          className="card absolute -right-2 top-[calc(100%+0.625rem)] z-50 flex w-[calc(100vw-2rem)] flex-col items-end gap-1 px-4 py-4 text-right shadow-lg xs:-right-3"
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
