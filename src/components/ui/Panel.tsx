import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";

export function Panel({
  title,
  actions,
  pad,
  className,
  children,
}: {
  title: string;
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
