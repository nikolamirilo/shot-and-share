/**
 * Joins class names, dropping anything falsy. A string helper rather than a
 * component, so nothing has to pull in the design system to build a class.
 */
export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
