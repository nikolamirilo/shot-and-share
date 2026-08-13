"use client";

import { createContext } from "react";

export interface TabsContextValue {
  active: string;
  domId: (id: string) => string;
}

export const TabsContext = createContext<TabsContextValue | null>(null);
