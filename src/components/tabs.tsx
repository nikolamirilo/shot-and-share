"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cx } from "@/components/ui";

/**
 * Tabs that only exist on a phone.
 *
 * A host editing an event on a laptop has the whole console in front of them
 * and a two-column grid to put it in, so nothing is hidden there: above `lg`
 * the tab strip disappears and every panel is shown, exactly as it was. Below
 * it, where the same console is a single column two thumbs long, one group is
 * shown at a time and the strip is how you move between them.
 *
 * That is why visibility is done in CSS rather than by mounting and unmounting.
 * A panel that is switched away from keeps its typed text, its unsaved
 * choices and its scroll position, and the page still ships every panel's
 * markup on the first response - the tabs are a way of looking at the page,
 * not a way of loading it.
 */

export interface TabItem {
  id: string;
  label: string;
}

interface TabsContextValue {
  active: string;
  domId: (id: string) => string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({
  items,
  label,
  idPrefix,
  sticky = false,
  /**
   * Pixels of chrome already pinned to the top of the viewport. Used both for
   * where a sticky strip sits and for how far a panel is scrolled down when it
   * is opened, so a tap never lands you underneath something.
   */
  stickyOffset = 0,
  className,
  tablistClassName,
  children,
}: {
  items: TabItem[];
  label: string;
  idPrefix?: string;
  sticky?: boolean;
  stickyOffset?: number;
  className?: string;
  tablistClassName?: string;
  children: ReactNode;
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const moved = useRef(false);

  const domId = useCallback(
    (id: string) => (idPrefix ? `${idPrefix}-${id}` : id),
    [idPrefix],
  );

  const open = useCallback((id: string) => {
    setActive(id);
    moved.current = true;
  }, []);

  /**
   * A link to `#upgrade` has to keep working now that the panel it points at
   * can be the closed one. The hash names a panel, so it also names the tab.
   */
  useEffect(() => {
    function fromHash() {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash) return;
      const match = items.find((item) => domId(item.id) === hash);
      if (match) open(match.id);
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [items, domId, open]);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;

    const index = items.findIndex((item) => item.id === active);
    buttons.current[index]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });

    // Only when the strip has already scrolled off the top: opening a tab from
    // a page that has not moved should not yank the event's name out of view.
    const el = wrapRef.current;
    if (el && el.getBoundingClientRect().top < stickyOffset) {
      el.scrollIntoView({ block: "start" });
    }
  }, [active, items, stickyOffset]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    open(items[next].id);
    buttons.current[next]?.focus();
  }

  return (
    <div
      ref={wrapRef}
      className={className}
      style={stickyOffset ? { scrollMarginTop: stickyOffset } : undefined}
    >
      {/* Five labels do not fit across a 360px phone, so the strip scrolls
          sideways rather than wrapping onto a second row that would cost as
          much height as a panel heading. */}
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        className={cx(
          "flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden",
          sticky &&
            "z-30 border-b-2 border-pepper/12 bg-butter/95 pt-2 backdrop-blur",
          tablistClassName,
        )}
        style={sticky ? { position: "sticky", top: stickyOffset } : undefined}
      >
        {items.map((item, index) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                buttons.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${domId(item.id)}-tab`}
              aria-selected={selected}
              aria-controls={domId(item.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => open(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cx(
                "min-h-11 shrink-0 touch-manipulation whitespace-nowrap rounded-xl border-2 border-pepper px-3.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em]",
                selected
                  ? "bg-gouda shadow-[3px_3px_0_var(--color-pepper)]"
                  : "bg-cream text-crust",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <TabsContext.Provider value={{ active, domId }}>
        {children}
      </TabsContext.Provider>
    </div>
  );
}

/**
 * One group of settings. `display` is what the panel becomes when it is open -
 * the grid panels keep their own two-column layout on a laptop, so the class
 * pairs are written out in full for the compiler to find.
 */
export function TabPanel({
  id,
  display = "block",
  className,
  children,
}: {
  id: string;
  display?: "block" | "grid";
  className?: string;
  children: ReactNode;
}) {
  const ctx = useContext(TabsContext);
  const active = ctx?.active === id;
  const domId = ctx ? ctx.domId(id) : id;

  return (
    <div
      id={domId}
      role="tabpanel"
      aria-labelledby={`${domId}-tab`}
      className={cx(
        active
          ? display === "grid"
            ? "grid"
            : "block"
          : display === "grid"
            ? "hidden lg:grid"
            : "hidden lg:block",
        className,
      )}
    >
      {children}
    </div>
  );
}
