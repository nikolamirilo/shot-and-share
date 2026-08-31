"use client";

import { createContext } from "react";

export interface TabsContextValue {
  active: string;
  domId: (id: string) => string;
  /**
   * Open a tab from inside a panel, for the panels that point at each other -
   * "you need a paid plan for this" belongs next to a way of getting one.
   *
   * A link to `#upgrade` cannot do that job from a page that is already open.
   * The router handles a same-page hash with `history.pushState`, which fires
   * no `hashchange`, so the listener below never hears it and the button looks
   * broken. Reaching the tab state directly has nothing to miss.
   */
  open: (id: string) => void;
}

export const TabsContext = createContext<TabsContextValue | null>(null);
