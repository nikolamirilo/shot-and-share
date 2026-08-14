/**
 * The look of a guest's event page - the "custom event page" the paid plans
 * promise. A free event gets the product's own theme and a small header and
 * footer.
 *
 * The gate is applied when the appearance is *read*, not only when written: on
 * write alone, a stale row or any path that skips the form serves paid styling.
 */

export interface Palette {
  /** Page background. */
  bg: string;
  /** Cards and panels sitting on the background. */
  surface: string;
  accent: string;
  accentSoft: string;
  accentDeep: string;
  /** Text, buttons, shadows. */
  ink: string;
  /** Secondary text. */
  muted: string;
  /** Body copy that is not quite ink. */
  deep: string;
  /** The inside of every well a photograph sits in. */
  hole: string;
  /** Text that has to read on `accent`. Chosen, never assumed. */
  onAccent: string;
}

export interface Theme {
  id: string;
  name: string;
  hint: string;
  palette: Palette;
}

/**
 * Every preset is light, and that is a rule rather than a coincidence.
 *
 * An event page is looked at twice: on a phone held up at the party, and on a
 * laptop the next morning. A dark page wins the first and loses the second, and
 * it fights every photograph on it - a wedding is white dresses and daylight,
 * a birthday is a lit cake, and both sit in a dark frame like a mistake. Light
 * pages also print, screenshot and paste into a group chat without surprises.
 *
 * The ten are the colours events are actually held in, in the order a host
 * meets them: the house claret for anything at night, ivory and gold, dusty
 * rose, terracotta, butter yellow, sage, dusty blue, navy, lilac, and white. A
 * host who wants something else has the custom picker - which is held to the
 * same rule, see buildCustomPalette.
 */
export const THEMES: Theme[] = [
  {
    id: "cheese",
    name: "Shot & Share",
    hint: "The house palette. Claret on warm white - weddings, parties, anything at night.",
    palette: {
      bg: "#F6F2F3",
      surface: "#FFFFFF",
      accent: "#7A1230",
      accentSoft: "#C25A72",
      accentDeep: "#5C0B23",
      ink: "#181214",
      muted: "#776A6E",
      deep: "#6C5F62",
      hole: "#241A1D",
      onAccent: "#FDF6F7",
    },
  },
  {
    id: "ivory",
    name: "Ivory",
    hint: "Ivory and antique gold. The wedding palette, and the one that suits almost anything.",
    palette: {
      bg: "#FAF6EC",
      surface: "#FFFFFF",
      accent: "#C6A15B",
      accentSoft: "#DFC694",
      accentDeep: "#9E7F41",
      ink: "#241F16",
      onAccent: "#241F16",
      muted: "#7C6A46",
      deep: "#4C4231",
      hole: "#2C261A",
    },
  },
  {
    id: "blush",
    name: "Blush",
    hint: "Dusty rose and plum. Engagements, showers, spring weddings.",
    palette: {
      bg: "#FBF1EF",
      surface: "#FFFAF9",
      accent: "#DFA69E",
      accentSoft: "#EFC9C3",
      accentDeep: "#B87A72",
      ink: "#2A1917",
      onAccent: "#2A1917",
      muted: "#96605A",
      deep: "#66403B",
      hole: "#3B2320",
    },
  },
  {
    id: "terracotta",
    name: "Terracotta",
    hint: "Burnt orange and clay. Autumn weddings, long tables, anything outdoors.",
    palette: {
      bg: "#FCF1E9",
      surface: "#FFFAF6",
      accent: "#B4531F",
      accentSoft: "#E3A171",
      accentDeep: "#8A3D13",
      ink: "#2A1A12",
      onAccent: "#FFF6EF",
      muted: "#8A5133",
      deep: "#5C3A28",
      hole: "#352117",
    },
  },
  {
    id: "butter",
    name: "Butter",
    hint: "Soft yellow and honey. Summer parties, brunches, anything in daylight.",
    palette: {
      bg: "#FFF8E3",
      surface: "#FFFDF6",
      accent: "#EFB93F",
      accentSoft: "#F8DB99",
      accentDeep: "#B98A22",
      ink: "#2A2213",
      onAccent: "#2A2213",
      muted: "#7C6426",
      deep: "#4E4021",
      hole: "#322915",
    },
  },
  {
    id: "sage",
    name: "Sage",
    hint: "Sage green and cream. Quiet, and good with greenery.",
    palette: {
      bg: "#F0F4EA",
      surface: "#FBFCF7",
      accent: "#A5BD8B",
      accentSoft: "#C8D9B5",
      accentDeep: "#7B9761",
      ink: "#1D2318",
      onAccent: "#1D2318",
      muted: "#566A48",
      deep: "#3A4A31",
      hole: "#232C1D",
    },
  },
  {
    id: "sky",
    name: "Sky",
    hint: "Dusty blue and slate. Christenings, milestone birthdays, anything formal.",
    palette: {
      bg: "#EEF3F8",
      surface: "#FBFDFF",
      accent: "#9FBDD8",
      accentSoft: "#C6DAEA",
      accentDeep: "#6B90B1",
      ink: "#16202B",
      onAccent: "#16202B",
      muted: "#4E6A80",
      deep: "#33475A",
      hole: "#1D2B37",
    },
  },
  {
    id: "navy",
    name: "Navy",
    hint: "Navy and pale grey. Black tie, receptions, anything with a dress code.",
    palette: {
      bg: "#EEF1F7",
      surface: "#FBFCFF",
      accent: "#2F4A75",
      accentSoft: "#8199BE",
      accentDeep: "#1F3454",
      ink: "#141A24",
      onAccent: "#F3F6FC",
      muted: "#495B78",
      deep: "#2E3B4E",
      hole: "#1A2029",
    },
  },
  {
    id: "lilac",
    name: "Lilac",
    hint: "Lavender and violet. Spring weddings, showers, milestone birthdays.",
    palette: {
      bg: "#F4F0FA",
      surface: "#FCFAFF",
      accent: "#7059A8",
      accentSoft: "#BFB0DF",
      accentDeep: "#544082",
      ink: "#221B2E",
      onAccent: "#F8F5FE",
      muted: "#5E4E80",
      deep: "#3F3553",
      hole: "#2A2138",
    },
  },
  {
    id: "ink",
    name: "White",
    hint: "White and charcoal. Lets the photographs do everything.",
    palette: {
      bg: "#F4F2EE",
      surface: "#FFFFFF",
      accent: "#DCD6CA",
      accentSoft: "#EDE9E1",
      accentDeep: "#B5AE9F",
      ink: "#16150F",
      onAccent: "#16150F",
      muted: "#6A665B",
      deep: "#3A372E",
      hole: "#201E17",
    },
  },
];

export const DEFAULT_THEME_ID = "cheese";
export const CUSTOM_THEME_ID = "custom";

export function findTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/* -------------------------------------------------------------------------- */
