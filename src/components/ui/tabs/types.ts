import type { ReactNode } from "react";

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
  /**
   * The one lifted out of the bar: a claret circle standing half above the top
   * edge, in the middle of the row whatever order this list is in. At most one,
   * and it wants an odd number of tabs so the rest divide evenly around it.
   */
  raised?: boolean;
}
