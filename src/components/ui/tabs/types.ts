import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  short?: string;
  icon?: ReactNode;
  raised?: boolean;
}
