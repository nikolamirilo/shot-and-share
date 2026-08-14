"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { TabsContext } from "@/components/ui/tabs/context";
import {
  type TabShape,
  raisedIconClass,
  tabButtonClass,
  tablistClass,
} from "@/components/ui/tabs/styles";
import type { TabItem } from "@/components/ui/tabs/types";
import { cx } from "@/lib/cx";

/**
 * One group at a time, on every screen.
 *
 * `desktop` decides what the buttons look like once there is room for a choice:
 * a `strip` is a row that scrolls sideways at every width, a `rail` stands them
 * up in a column beside the panel on a laptop.
 *
 * `mobile` decides what they become on a phone. A `strip` is fine for three or
 * four and stops being fine at six: the ones past the edge are not hard to
 * reach, they are unknown. A `bar` is the same buttons pinned to the bottom,
 * all of them at once, in the half of a phone a thumb can reach.
 *
 * `variant` exists because these nest. The event page's settings are tabs
 * inside the console's own tabs, and drawn the same way the two rows read as
 * one confused navigation. `segmented` is a single joined control instead.
 */
export function Tabs({
  items,
  label,
  idPrefix,
  desktop = "strip",
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
  /**
   * One element, two shapes. Rendering a bar *and* a strip would mean two
   * tablists over one set of panels - two elements carrying `id="share-tab"`,
   * and every `aria-labelledby` pointing at whichever the browser found first.
   */
  const shape: TabShape = {
    rail: desktop === "rail",
    segmented: variant === "segmented",
    bar: mobile === "bar",
    sticky,
  };

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
      key === "ArrowRight" || (shape.rail && key === "ArrowDown")
        ? index === last
          ? 0
          : index + 1
        : key === "ArrowLeft" || (shape.rail && key === "ArrowUp")
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
        shape.rail && "lg:grid lg:grid-cols-[13rem_1fr] lg:items-start lg:gap-8",
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
      <div
        role="tablist"
        aria-label={label}
        aria-orientation={shape.rail ? "vertical" : "horizontal"}
        className={tablistClass(shape, tablistClassName)}
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
              className={tabButtonClass(shape, {
                selected,
                raised: Boolean(item.raised),
                order: barOrder(items, item),
              })}
            >
              {shape.bar && item.raised && item.icon && (
                <span aria-hidden className={raisedIconClass(selected)}>
                  {item.icon}
                </span>
              )}
              {shape.bar && !item.raised && item.icon && (
                <span aria-hidden className="text-[1.3125rem] sm:hidden">
                  {item.icon}
                </span>
              )}
              {/* The short name is what the bar has room for; the full one is
                  the accessible name at every width, so a screen reader hears
                  "Event page" rather than "Page" whatever the screen is. */}
              {shape.bar && (
                <span aria-hidden className="tracking-[0.04em] sm:hidden">
                  {item.short ?? item.label}
                </span>
              )}
              <span className={cx(shape.bar && "sr-only sm:not-sr-only")}>
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
 * Where each button sits in the bar, which is not the order they are declared
 * in. The list is written in the order the desktop rail reads - the first thing
 * a host does, first - and the bar puts the raised one in the middle and
 * divides the others evenly around it. Below `sm` only.
 */
const ORDER = [
  "max-sm:order-1",
  "max-sm:order-2",
  "max-sm:order-3",
  "max-sm:order-4",
  "max-sm:order-5",
  "max-sm:order-6",
];

function barOrder(items: TabItem[], item: TabItem): string | false {
  const others = items.filter((i) => !i.raised);
  const half = Math.floor(others.length / 2);
  if (item.raised) return ORDER[half];
  const among = others.indexOf(item);
  return ORDER[among < half ? among : among + 1];
}
