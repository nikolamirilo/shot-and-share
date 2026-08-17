import { cx } from "@/lib/cx";

/**
 * Every class the tab strip can wear, keyed by the shape it is being.
 *
 * Tailwind scans for whole class strings, so they are written out in full
 * rather than composed - which is what makes this a table rather than a
 * function.
 */

export interface TabShape {
  /** A column beside the panel on a laptop rather than a row above it. */
  rail: boolean;
  /** One joined control in a sunken track, for tabs nested inside tabs. */
  segmented: boolean;
  /** Pinned across the bottom of a phone, one equal column per tab. */
  bar: boolean;
  sticky: boolean;
}

export function tablistClass(shape: TabShape, extra?: string): string {
  const { rail, segmented, bar, sticky } = shape;

  return cx(
    "flex [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    // A bar never scrolls sideways, and must not clip either: the raised button
    // stands outside the row's own box. Declaring the two overflows in separate
    // branches keeps them from fighting over which rule the compiler emitted
    // last.
    !bar && "overflow-x-auto",
    bar && "overflow-visible sm:overflow-x-auto",
    !segmented && "gap-2 pb-2",
    // A sunken track with the segments sitting in it. The control is one object
    // because of the trough they share, not because a line is drawn around it.
    segmented && "inset-shadow-well w-full gap-1 rounded-full bg-ink/8 p-1",
    // `pb` clears the home indicator on the phones that have one and is a
    // normal 0.4rem on the ones that do not.
    bar &&
      "fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col items-end gap-0 border-t border-edge bg-paper/95 px-1 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur",
    bar &&
      "sm:static sm:z-auto sm:flex sm:items-stretch sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-2 sm:shadow-none sm:backdrop-blur-none",
    rail && "lg:flex-col lg:gap-1.5 lg:overflow-x-visible lg:pb-0",
    sticky && !bar && "sticky top-(--tab-top) z-30",
    sticky && !bar && "bg-linen/95 pt-2 shadow-sm backdrop-blur",
    // A bar is already pinned, so it takes the sticky treatment only once it
    // has stopped being one.
    sticky && bar && "sm:sticky sm:top-(--tab-top) sm:z-30",
    sticky && bar && "sm:bg-linen/95 sm:pt-2 sm:shadow-sm sm:backdrop-blur",
    // Beside the panel there is nothing to divide it from, and a bar of colour
    // behind a column of buttons is just a second box.
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
    /** Where this button sits in the bar. False above `sm`. */
    order: string | false;
  },
): string {
  const { rail, segmented, bar } = shape;

  return cx(
    "min-h-11 shrink-0 touch-manipulation whitespace-nowrap",
    // In the bar the button is a column of icon over label with no shape of its
    // own: six raised pills across a phone would be a wall, and the row already
    // has an edge to sit on. Colour alone carries which one is open, which is
    // why the icon is there - it is the difference between two claret words and
    // one claret thing.
    bar && order,
    bar &&
      "flex flex-col items-center justify-end gap-0.5 rounded-lg px-0.5 py-1 transition-colors",
    bar && (selected ? "bg-transparent text-claret" : "bg-transparent text-mist"),
    bar && "shadow-none",
    // The raised one keeps its colour whether or not it is open. It is the
    // loudest thing in the interface and turning that off and on again would
    // spend it for nothing - which one is open is said by the halo instead.
    bar && raised && "text-claret",
    bar && "sm:flex-row sm:gap-2 sm:rounded-xl sm:px-3.5 sm:py-0 sm:transition-none",
    bar &&
      (selected
        ? "sm:bg-claret sm:text-chalk sm:shadow-md"
        : "sm:bg-paper sm:text-ash sm:shadow-sm"),
    // The mono label is the same everywhere. Its shape is not: a pill in the
    // strip, a bare column in the bar, and declaring both unconditionally would
    // leave `px-3.5` and `px-0.5` on one element to be settled by whichever the
    // compiler wrote last.
    !segmented && "font-mono text-micro uppercase",
    !segmented && !bar && "rounded-xl px-3.5 tracking-[0.16em]",
    !segmented && bar && "sm:tracking-[0.16em]",
    !segmented &&
      !bar &&
      (selected
        ? "bg-claret text-chalk shadow-md"
        : "bg-paper text-ash shadow-sm"),
    /*
     * `flex-1` against `shrink-0` is what makes one control out of five
     * buttons: the segments share whatever width the strip has, so the strip is
     * full at any width, and none may shrink below its own label, so on a phone
     * the row scrolls instead of squeezing "Uploads" onto two lines. The
     * padding is therefore a floor rather than a size.
     */
    segmented &&
      "flex-1 rounded-full px-2 text-label font-semibold leading-tight transition-colors",
    segmented &&
      (selected ? "bg-ink text-linen shadow-md" : "text-ash hover:bg-ink/6"),
    /*
     * `lg:justify-start` rather than `lg:text-left` alone: the bar shape leaves
     * `justify-end` on the button, which is right for a column of icon over
     * label and wrong the moment the same button is a full-width row in the
     * rail - it pins every name to the far edge of its pill, which is what a
     * rail with no icons looks broken as.
     */
    rail && "lg:w-full lg:justify-start lg:px-4 lg:text-left",
  );
}

/**
 * The raised button's circle.
 *
 * Measured against the *bar*, not against its own button: `left-1/2` is the
 * middle of the row, and `top-0` with a half translate puts its centre exactly
 * on the bar's top edge.
 *
 * The collar is a ring in the page's own colour. Above the edge it is
 * invisible, being linen on linen; below it, linen on paper. That is what makes
 * the button read as punched through the bar rather than dropped on top of it.
 */
export function raisedIconClass(selected: boolean): string {
  return cx(
    "absolute top-0 left-1/2 grid size-[3.375rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-claret text-[1.5rem] text-chalk shadow-lg ring-[5px] ring-linen sm:hidden",
    selected && "outline outline-[3px] outline-offset-[4px] outline-claret",
  );
}
