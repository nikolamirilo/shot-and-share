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
import { cx } from "@/utils/cx";

export function Tabs({
  items,
  label,
  idPrefix,
  desktop = "strip",
  mobile = "strip",
  variant = "pill",
  sticky = false,
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

    const el = wrapRef.current;
    if (el && el.getBoundingClientRect().top < stickyOffset) {
      el.scrollIntoView({ block: "start" });
    }
  }, [active, items, stickyOffset]);

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
              {item.icon && !shape.segmented && (
                <span
                  aria-hidden
                  className={cx(
                    "shrink-0 text-[0.9375rem]",
                    shape.bar && "hidden sm:block",
                  )}
                >
                  {item.icon}
                </span>
              )}
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

      <TabsContext.Provider value={{ active, domId, open }}>
        <div className="min-w-0">{children}</div>
      </TabsContext.Provider>
    </div>
  );
}

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
