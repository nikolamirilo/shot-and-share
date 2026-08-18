"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui";

/**
 * The button at the bottom of a server-action form. `useFormStatus` reads the
 * nearest parent `<form>`, so this must render inside one - which is what makes
 * it a component rather than a prop on the form.
 */
export function SubmitButton({
  idle,
  pending: pendingLabel,
  icon,
  ...props
}: {
  idle: string;
  /** What the label says while the action is in flight. */
  pending: string;
  /**
   * Names the action beside the label. It stays put while the action runs -
   * an icon that disappears on submit moves the words it sits next to.
   */
  icon?: ReactNode;
} & Omit<ComponentProps<typeof Button>, "type" | "disabled" | "children">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {icon}
      {pending ? pendingLabel : idle}
    </Button>
  );
}
