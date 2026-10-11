"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui";

/**
 * `useFormStatus` reads the nearest parent `<form>`, so this must render inside one.
 */
export function SubmitButton({
  idle,
  pending: pendingLabel,
  icon,
  ...props
}: {
  idle: string;
  pending: string;
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
