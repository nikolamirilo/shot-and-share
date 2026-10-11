"use client";

import { createContext } from "react";

export interface TabsContextValue {
  active: string;
  domId: (id: string) => string;
  open: (id: string) => void;
}

export const TabsContext = createContext<TabsContextValue | null>(null);
