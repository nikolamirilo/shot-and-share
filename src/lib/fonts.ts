export interface FontSet {
  id: string;
  name: string;
  hint: string;
  display: string;
  body: string;
  displayWeight: number;
  displayStretch: string;
  displayTracking: string;
  /** Empty for the house set: the root layout already loads it for every page. */
  families: string[];
}

export const FONT_SETS: FontSet[] = [
  {
    id: "cheese",
    name: "Shot & Share",
    hint: "The house pairing. Heavy and narrow over something that stays quiet.",
    display: '"Archivo", ui-sans-serif, system-ui, sans-serif',
    body: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
    displayWeight: 800,
    displayStretch: "82%",
    displayTracking: "-0.046em",
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
    hint: "One condensed face, very heavy. Reads from across a room.",
    display: '"Anton", ui-sans-serif, system-ui, sans-serif',
    body: '"Inter", ui-sans-serif, system-ui, sans-serif',
    displayWeight: 400,
    displayStretch: "100%",
    displayTracking: "-0.02em",
    families: ["Anton", "Inter:wght@100..900"],
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

export function fontToCssVars(font: FontSet): Record<string, string> {
  return {
    "--font-display": font.display,
    "--font-sans": font.body,
    "--font-display-weight": String(font.displayWeight),
    "--font-display-stretch": font.displayStretch,
    "--font-display-tracking": font.displayTracking,
  };
}

export function googleFontsHref(font: FontSet): string | null {
  if (font.families.length === 0) return null;
  const families = font.families.map((f) => `family=${f}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
