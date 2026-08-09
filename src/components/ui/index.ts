/**
 * The design system, one file per primitive.
 *
 * This barrel exists so a page can ask for four things in one line, which is
 * how nearly every page uses it. `cx` is re-exported from @/lib/cx because it
 * used to live in here and half the codebase imports it from this path - it is
 * a string helper, and non-React callers should reach for @/lib/cx directly.
 */
export { cx } from "@/lib/cx";

export { Alert } from "@/components/ui/alert";
export { Badge } from "@/components/ui/badge";
export { Button, ButtonLink } from "@/components/ui/button";
export { Card } from "@/components/ui/card";
export { Eyebrow } from "@/components/ui/eyebrow";
export { Field, inputClass } from "@/components/ui/field";
export { Hole } from "@/components/ui/hole";
export { Panel } from "@/components/ui/panel";
export { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
export { ProgressBar } from "@/components/ui/progress-bar";
export { Stat } from "@/components/ui/stat";
