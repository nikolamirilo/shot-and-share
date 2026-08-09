"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui";

/**
 * The button at the bottom of a server-action form.
 *
 * `useFormStatus` reads the nearest parent `<form>`, so this has to be rendered
 * inside one rather than beside it - which is what makes it a component and not
 * a prop on the form. Five forms each had their own copy of this, identical
 * apart from the two labels.
 */
export function SubmitButton({
  idle,
  pending: pendingLabel,
  ...props
}: {
  idle: string;
  /** What the label says while the action is in flight. */
  pending: string;
} & Omit<ComponentProps<typeof Button>, "type" | "disabled" | "children">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : idle}
    </Button>
  );
}
