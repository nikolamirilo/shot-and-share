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
  /**
   * The two fields the bottom bar needs, and nothing else uses. Six labels
   * share the width of a phone there, which is about ten characters each -
   * "Event page" and "Analytics" do not survive that, so they get a shorter
   * name and an icon to carry the meaning the letters gave up.
   */
  short?: string;
  icon?: ReactNode;
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
  /**
   * What the buttons become on a phone. A `strip` scrolls sideways, which is
   * fine for three or four of them and stops being fine at six: the ones past
   * the edge are not hard to reach, they are unknown, because the scrollbar is
   * hidden and nothing marks where the row continues.
   *
   * A `bar` is the same buttons pinned to the bottom of the screen, all of them
   * at once, in the half of a phone a thumb can actually reach. It is one row
   * of six rather than a row of six hundred pixels.
   */
  mobile = "strip",
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
  mobile?: "strip" | "bar";
  variant?: "pill" | "segmented";
  sticky?: boolean;
  stickyOffset?: number;
  className?: string;
  tablistClassName?: string;
  children: ReactNode;
}) {
  const rail = desktop === "rail";
  const segmented = variant === "segmented";
  /**
   * One element, two shapes. Rendering a bar *and* a strip would mean two
   * tablists over one set of panels - two elements carrying `id="share-tab"`,
   * and every `aria-labelledby` on the page pointing at whichever the browser
   * found first. So the bar is what this row is below `sm`, and the strip is
   * what it becomes above it, which is also where six pills start fitting.
   */
  const bar = mobile === "bar";
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
          segmented && "inset-shadow-well w-full gap-1 rounded-full bg-ink/8 p-1",
          // Pinned across the bottom of a phone, one equal column per tab, and
          // back to being an ordinary row from `sm` up. `pb` clears the home
          // indicator on the phones that have one and is a normal 0.4rem on the
          // ones that do not.
          bar &&
            "fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 gap-0 overflow-visible border-t border-edge bg-paper/95 px-1 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur",
          bar &&
            "sm:static sm:z-auto sm:flex sm:gap-2 sm:overflow-x-auto sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-2 sm:shadow-none sm:backdrop-blur-none",
          rail && "lg:flex-col lg:gap-1.5 lg:overflow-x-visible lg:pb-0",
          sticky && !bar && "sticky top-(--tab-top) z-30",
          sticky && !bar && "bg-linen/95 pt-2 shadow-sm backdrop-blur",
          // A bar is already pinned, so it takes the sticky treatment only once
          // it has stopped being one.
          sticky && bar && "sm:sticky sm:top-(--tab-top) sm:z-30",
          sticky && bar && "sm:bg-linen/95 sm:pt-2 sm:shadow-sm sm:backdrop-blur",
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
                // In the bar the button is a column of icon over label with no
                // shape of its own: six raised pills across a phone would be a
                // wall, and the row already has an edge of its own to sit on.
                // Colour alone carries which one is open, which is why the icon
                // is there - it is the difference between two claret words and
                // one claret thing.
                bar &&
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors",
                bar &&
                  (selected
                    ? "bg-transparent text-claret shadow-none"
                    : "bg-transparent text-mist shadow-none"),
                bar &&
                  "sm:flex-row sm:gap-2 sm:rounded-xl sm:px-3.5 sm:py-0 sm:transition-none",
                bar &&
                  (selected
                    ? "sm:bg-claret sm:text-chalk sm:shadow-md"
                    : "sm:bg-paper sm:text-ash sm:shadow-sm"),
                !segmented &&
                  "rounded-xl px-3.5 font-mono text-micro uppercase tracking-[0.16em]",
                !segmented &&
                  !bar &&
                  (selected
                    ? "bg-claret text-chalk shadow-md"
                    : "bg-paper text-ash shadow-sm"),
                // Both states are raised - a flat pill on a Linen page would
                // not read as a control at all - but the open one is raised
                // further and filled with Claret, so the difference is height
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
                    ? "bg-ink text-linen shadow-md"
                    : "text-ash hover:bg-ink/6"),
                rail && "lg:w-full lg:px-4 lg:text-left",
              )}
            >
              {bar && item.icon && (
                <span aria-hidden className="text-[1.3125rem] sm:hidden">
                  {item.icon}
                </span>
              )}
              {/* The short name is what the bar has room for; the full one is
                  the accessible name at every width, so a screen reader hears
                  "Event page" rather than "Page" whatever the screen is. */}
              {bar && (
                <span aria-hidden className="tracking-[0.04em] sm:hidden">
                  {item.short ?? item.label}
                </span>
              )}
              <span className={cx(bar && "sr-only sm:not-sr-only")}>
                {item.label}
              </span>
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
