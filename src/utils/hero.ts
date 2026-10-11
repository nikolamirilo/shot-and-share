/** The marketing hero stills, named 01..12 in `public/hero/variants`. */
export function heroFrame(n: number): string {
  return `/hero/variants/${String(n).padStart(2, "0")}.jpg`;
}
