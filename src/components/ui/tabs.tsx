"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cx } from "@/components/ui";

/**
 * One group at a time, on every screen.
 *
 * `desktop` only decides what the buttons look like once there is room for a
 * choice. A `strip` is the row that scrolls sideways, the same at every width.
 * A `rail` keeps that row on a phone and stands the buttons up in a column
 * beside the panel on a laptop, where a page-wide strip would leave most of a
 * 1400px screen empty above the thing it opens.
 *
 * `variant` is the other axis, and it exists because these can nest. The event
 * page's settings are a set of tabs inside the console's own tabs, and drawn
 * the same way - separate pills, mono, uppercase - the two rows read as one
 * confused navigation. `segmented` is a single joined control instead: one
 * sunken strip, sentence case, the same shape the gallery's layout switcher
 * already uses. Different object, different job.
 *
 * Visibility is done in CSS rather than by mounting and unmounting. A panel
 * that is switched away from keeps its typed text, its unsaved choices and its
 * scroll position, and the page still ships every panel's markup on the first
 * response - the tabs are a way of looking at the page, not a way of loading
 * it.
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
  desktop = "strip",
  variant = "pill",
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
  desktop?: "strip" | "rail";
  variant?: "pill" | "segmented";
  sticky?: boolean;
  stickyOffset?: number;
  className?: string;
  tablistClassName?: string;
  children: ReactNode;
}) {
  const rail = desktop === "rail";
  const segmented = variant === "segmented";
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

  /**
   * A rail is a row on a phone and a column on a laptop, so both axes move
   * between tabs there. A strip is a row everywhere and leaves up and down to
   * the page, which is still trying to scroll.
   */
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    const key = event.key;
    const next =
      key === "ArrowRight" || (rail && key === "ArrowDown")
        ? index === last
          ? 0
          : index + 1
        : key === "ArrowLeft" || (rail && key === "ArrowUp")
          ? index === 0
            ? last
            : index - 1
          : key === "Home"
            ? 0
            : key === "End"
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
      className={cx(
        rail && "lg:grid lg:grid-cols-[13rem_1fr] lg:items-start lg:gap-8",
        className,
      )}
      /* The offset is a variable rather than an inline `top` because an inline
         style cannot be undone by a media query, and the rail sits somewhere
         else on a laptop than the strip does on a phone. */
      style={
        {
          "--tab-top": `${stickyOffset}px`,
          scrollMarginTop: stickyOffset || undefined,
        } as CSSProperties
      }
    >
      {/* Five labels do not fit across a 360px phone, so the strip scrolls
          sideways rather than wrapping onto a second row that would cost as
          much height as a panel heading. Standing up as a rail, it has the
          whole column and needs neither.

          A segmented control scrolls the same way, inside its own track: the
          five settings groups fit across a laptop column but not across a
          phone, and a joined strip that wraps stops looking like one control. */}
      <div
        role="tablist"
        aria-label={label}
        aria-orientation={rail ? "vertical" : "horizontal"}
        className={cx(
          "flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          !segmented && "gap-2 pb-2",
          // A sunken track with the segments sitting in it. The control is one
          // object because of the trough they share, not because a line is
          // drawn around them.
          segmented && "inset-shadow-well w-full gap-1 rounded-full bg-pepper/8 p-1",
          rail && "lg:flex-col lg:gap-1.5 lg:overflow-x-visible lg:pb-0",
          sticky && "sticky top-(--tab-top) z-30",
          sticky && "bg-butter/95 pt-2 shadow-sm backdrop-blur",
          // Beside the panel there is nothing to divide it from, and the bar
          // of colour behind a column of buttons is just a second box.
          sticky &&
            rail &&
            "lg:top-6 lg:bg-transparent lg:pt-0 lg:shadow-none lg:backdrop-blur-none",
          tablistClassName,
        )}
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
                "min-h-11 shrink-0 touch-manipulation whitespace-nowrap",
                !segmented &&
                  "rounded-xl px-3.5 font-mono text-micro uppercase tracking-[0.16em]",
                !segmented &&
                  (selected
                    ? "bg-gouda shadow-md"
                    : "bg-cream text-crust shadow-sm"),
                // Both states are raised - a flat pill on a Butter page would
                // not read as a control at all - but the open one is raised
                // further and filled with Gouda, so the difference is height
                // and colour rather than an outline appearing.
                //
                // `flex-1` against `shrink-0` is what makes one control out of
                // five buttons: the segments share whatever width the strip
                // has, so the strip is full at any width, and none of them may
                // shrink below its own label, so on a phone the row scrolls
                // instead of squeezing "Uploads" onto two lines.
                //
                // The padding is therefore a floor rather than a size - it is
                // what decides whether five labels fit across a phone at all,
                // and everywhere wider than that the growing does the spacing.
                segmented &&
                  "flex-1 rounded-full px-2 text-label font-semibold leading-tight transition-colors",
                segmented &&
                  (selected
                    ? "bg-pepper text-butter shadow-md"
                    : "text-crust hover:bg-pepper/6"),
                rail && "lg:w-full lg:px-4 lg:text-left",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* One cell, so that however many panels are inside they all sit in the
          rail's second column rather than taking turns with it. */}
      <TabsContext.Provider value={{ active, domId }}>
        <div className="min-w-0">{children}</div>
      </TabsContext.Provider>
    </div>
  );
}

/**
 * One group of settings. `display` is what the panel becomes when it is open -
 * the grid panels keep their own two-column layout on a laptop, so both classes
 * are written out in full for the compiler to find.
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
        active ? (display === "grid" ? "grid" : "block") : "hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
