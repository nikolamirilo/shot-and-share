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
    /* Deliberately not `relative`: the panel below is measured against the
       *header*, which every caller positions (see HeaderShell), so its edges
       land on the bar's rather than on the icon's own 44px box. */
    <div ref={wrapRef} className={cx("flex items-center", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="mobile-menu-panel"
        /* 44px of tap target around a 24px glyph, so the button carries 10px
           of padding either side. Pulling it out by exactly that much puts the
           glyph on the pill's own inset - the same edge the wordmark starts
           on - at whatever padding the pill is running. */
        className="-mr-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-blush"
      >
        {open ? <MdClose /> : <MdMenu />}
      </button>

      {open && (
        <div
          id="mobile-menu-panel"
          /* An absolute inset is measured from the containing block's padding
             box, and the header's padding *is* the page gutter - so `inset-x-0`
             puts both edges of the panel on the bar's, and `top-full` is the
             header's bottom,
             which is the bar's - the header has no padding under it. `mt-2` is
             the gap between the two.

             The paper is the bar's, at full strength: the bar can be sheer
             because it is a strip over the page, but a panel you read a list
             off cannot - the cards underneath were showing straight through
             the items. */
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
