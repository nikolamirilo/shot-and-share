import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

/**
 * A titled card - the shape almost every console panel takes. The title row
 * only exists when there is a control to put in it, because an empty flex row
 * still changes how the heading sits.
 */
export function Panel({
  title,
  actions,
  pad,
  className,
  children,
}: {
  title: string;
  /** Rendered on the title's line, pushed right. The save button, usually. */
  actions?: ReactNode;
  pad?: "snug" | "roomy" | "none";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card as="section" pad={pad} className={className}>
      {actions ? (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <h2 className="min-w-0 text-h3">{title}</h2>
          {actions}
        </div>
      ) : (
        <h2 className="text-h3">{title}</h2>
      )}
      {children}
    </Card>
  );
}
