/**
 * The type on a guest's event page.
 *
 * A host picks a *pairing*, not a font. Choosing a display face and a body face
 * that sit well together is the one part of typography that reliably goes wrong
 * when it is handed over, and a wedding page in Comic Sans is a support ticket
 * rather than a feature. So: five sets, each one tested against the layout.
 *
 * The mono face never changes. It labels the machine-readable parts — tokens,
 * short links, percentages — and that register is the product's, not the
 * event's.
 *
 * Each set also carries the three display settings the stylesheet cannot
 * assume. `font-stretch: 86%` is right for Bricolage, which has a width axis,
 * and meaningless for Playfair, which does not; -0.035em of tracking is right
 * for a heavy grotesque and too tight for a serif. Shipping them with the set
 * is what keeps a headline from looking broken the moment the face changes.
 */

export interface FontSet {
  id: string;
  name: string;
  hint: string;
  /** Headings. */
  display: string;
  /** Body copy, buttons, inputs. */
  body: string;
  displayWeight: number;
  /** Only does anything on a face with a width axis. */
  displayStretch: string;
  displayTracking: string;
  /**
   * Google Fonts family specifications, in the css2 API's own syntax.
   *
   * Empty for the house set: the root layout already loads it for every page,
   * so the default costs a guest nothing.
   */
  families: string[];
}

export const FONT_SETS: FontSet[] = [
  {
    id: "cheese",
    name: "Say Cheese",
    hint: "The house pairing. Heavy, slightly awkward, friendly underneath.",
    display: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif',
    body: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    displayWeight: 800,
    displayStretch: "86%",
    displayTracking: "-0.035em",
    families: [],
  },
  {
    id: "classic",
    name: "Classic",
    hint: "High-contrast serif over a quiet sans. Weddings, and anything formal.",
    display: '"Playfair Display", ui-serif, Georgia, serif',
    body: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
    displayWeight: 700,
    displayStretch: "100%",
    displayTracking: "-0.02em",
    families: ["Playfair+Display:wght@400..900", "Source+Sans+3:wght@200..900"],
  },
  {
    id: "modern",
    name: "Modern",
    hint: "Clean and technical. Offsites, launches, anything with a company name on it.",
    display: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    body: '"Inter", ui-sans-serif, system-ui, sans-serif',
    displayWeight: 700,
    displayStretch: "100%",
    displayTracking: "-0.03em",
    families: ["Space+Grotesk:wght@300..700", "Inter:wght@100..900"],
  },
  {
    id: "warm",
    name: "Warm",
    hint: "A soft serif with rounded body copy. Birthdays, christenings, family things.",
    display: '"Fraunces", ui-serif, Georgia, serif',
    body: '"Nunito Sans", ui-sans-serif, system-ui, sans-serif',
    displayWeight: 700,
    displayStretch: "100%",
    displayTracking: "-0.02em",
    families: ["Fraunces:opsz,wght@9..144,100..900", "Nunito+Sans:opsz,wght@6..12,200..1000"],
  },
  {
    id: "loud",
    name: "Loud",
    hint: "One family, very heavy and a little wide. Reads from across a room.",
    display: '"Archivo", ui-sans-serif, system-ui, sans-serif',
    body: '"Archivo", ui-sans-serif, system-ui, sans-serif',
    displayWeight: 900,
    displayStretch: "112%",
    displayTracking: "-0.04em",
    families: ["Archivo:wdth,wght@62..125,100..900"],
  },
];

export const DEFAULT_FONT_ID = "cheese";

const IDS = FONT_SETS.map((f) => f.id) as readonly string[];

export function isFontSetId(value: unknown): value is string {
  return typeof value === "string" && IDS.includes(value);
}

export function findFontSet(id: string | null | undefined): FontSet {
  return FONT_SETS.find((f) => f.id === id) ?? FONT_SETS[0];
}

export function coerceFont(value: unknown): string {
  return isFontSetId(value) ? value : DEFAULT_FONT_ID;
}

/**
 * The pairing as CSS custom properties.
 *
 * Same trick as the palette: these are the variable names the design system
 * already uses, so setting them on a wrapper re-types everything underneath
 * without any component knowing that fonts are configurable.
 */
export function fontToCssVars(font: FontSet): Record<string, string> {
  return {
    "--font-display": font.display,
    "--font-sans": font.body,
    "--font-display-weight": String(font.displayWeight),
    "--font-display-stretch": font.displayStretch,
    "--font-display-tracking": font.displayTracking,
  };
}

/**
 * The stylesheet this set needs, or null when the root layout already has it.
 *
 * Only the chosen set is requested on a guest page. Loading all five would put
 * eight font families on a phone on hotel wifi to render one of them.
 */
export function googleFontsHref(font: FontSet): string | null {
  if (font.families.length === 0) return null;
  const families = font.families.map((f) => `family=${f}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
