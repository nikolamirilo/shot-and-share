import { cx } from "@/utils/cx";

/**
 * Tailwind scans for whole class strings, so they are written out in full rather than
 * composed.
 */

export interface TabShape {
  rail: boolean;
  segmented: boolean;
  bar: boolean;
  sticky: boolean;
}

export function tablistClass(shape: TabShape, extra?: string): string {
  const { rail, segmented, bar, sticky } = shape;

  return cx(
    "flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    !bar && "overflow-x-auto",
    bar && "overflow-visible sm:overflow-x-auto",
    !segmented && "gap-2 pb-2",
    segmented && "inset-shadow-well w-full gap-1 rounded-full bg-ink/8 p-1",
    bar &&
      "fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col items-end gap-0 border-t border-edge bg-paper/95 px-1 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur",
    bar &&
      "sm:static sm:z-auto sm:flex sm:items-stretch sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-2 sm:shadow-none sm:backdrop-blur-none",
    rail && "lg:flex-col lg:gap-1.5 lg:overflow-x-visible lg:pb-0",
    sticky && !bar && "sticky top-(--tab-top) z-30",
    sticky && !bar && "bg-linen/95 pt-2 shadow-sm backdrop-blur",
    sticky && bar && "sm:sticky sm:top-(--tab-top) sm:z-30",
    sticky && bar && "sm:bg-linen/95 sm:pt-2 sm:shadow-sm sm:backdrop-blur",
    sticky &&
      rail &&
      "lg:top-6 lg:bg-transparent lg:pt-0 lg:shadow-none lg:backdrop-blur-none",
    extra,
  );
}

export function tabButtonClass(
  shape: TabShape,
  { selected, raised, order }: {
    selected: boolean;
    raised: boolean;
    order: string | false;
  },
): string {
  const { rail, segmented, bar } = shape;

  return cx(
    "min-h-11 shrink-0 touch-manipulation whitespace-nowrap",
    bar && order,
    bar &&
      "flex flex-col items-center justify-end gap-0.5 rounded-lg px-0.5 py-1 transition-colors",
    bar && (selected ? "bg-transparent text-claret" : "bg-transparent text-mist"),
    bar && "shadow-none",
    bar && raised && "text-claret",
    bar && "sm:flex-row sm:gap-2 sm:rounded-xl sm:px-3.5 sm:py-0 sm:transition-none",
    bar &&
      (selected
        ? "sm:bg-claret sm:text-chalk sm:shadow-md"
        : "sm:bg-paper sm:text-ash sm:shadow-sm"),
    !segmented && "font-mono text-micro uppercase",
    !segmented && !bar && "inline-flex items-center justify-center gap-2",
    !segmented && !bar && "rounded-xl px-3.5 tracking-[0.16em]",
    !segmented && bar && "sm:tracking-[0.16em]",
    !segmented &&
      !bar &&
      (selected
        ? "bg-claret text-chalk shadow-md"
        : "bg-paper text-ash shadow-sm"),
    segmented &&
      "flex-1 rounded-full px-2 text-label font-semibold leading-tight transition-colors",
    segmented &&
      (selected ? "bg-ink text-linen shadow-md" : "text-ash hover:bg-ink/6"),
    rail && "lg:w-full lg:justify-start lg:px-4 lg:text-left",
  );
}

export function raisedIconClass(selected: boolean): string {
  return cx(
    "absolute top-0 left-1/2 grid size-[3.375rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-claret text-[1.5rem] text-chalk shadow-lg ring-[5px] ring-linen sm:hidden",
    selected && "outline outline-[3px] outline-offset-[4px] outline-claret",
  );
}
