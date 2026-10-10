/**
 * The colours of anything sitting on the dark scrim: the lightbox's controls
 * and the report sheet inside it.
 *
 * These deliberately do not come from the event theme, and that is the whole
 * point of them. `chalk` means "whatever reads on the accent", so a host who
 * picks a pale accent gets a near-black chalk - Blush ships `#2A1917` for both
 * `chalk` and `ink` - and a chalk button with ink text on it is then black on
 * black. The controls were invisible on half the presets.
 *
 * The scrim belongs to the product rather than to the event, so its controls
 * do too. `--color-scrim` and `--color-scrim-ink` are defined once in
 * globals.css and are never handed to a theme; `paletteToCssVars` cannot reach
 * them, and a test holds that door shut.
 */
export const ON_SCRIM = "bg-scrim text-scrim-ink";

/**
 * Glass: white, mostly see-through, with the photograph blurred behind it.
 * Every control in the lightbox is made of it - the dock, the counter, the
 * close button, the two arrows and the report sheet - so none of them can
 * drift into looking like a different kind of thing from the one beside it.
 *
 * A name rather than the bare class because this is a decision with a reason
 * behind it, and the reason is written where the material is: globals.css,
 * under "Glass". The short version is that the type on it is dark, which is
 * what keeps it readable over a photograph of a night sky and over a
 * photograph of a white dress.
 */
export const GLASS = "glass";

/**
 * The same glass, thickened, for a panel carrying sentences rather than a
 * word: the report sheet. Thin glass is lovely under a four-letter label and
 * hard work under a paragraph, because what shows through it is a photograph
 * of a table full of flowers and the reader is trying to read.
 */
export const GLASS_DENSE = "glass bg-scrim/92";

/**
 * The quiet register, and only on `GLASS_DENSE`: the second line of the report
 * sheet, "Never mind". Softened ink on thin glass does not clear AA over a
 * dark photograph, so it is not offered there - a label on the dock is held
 * back by its size and its tracking instead.
 *
 * The scrim's own ink, never `ash` or `mist`, which the theme rewrites.
 */
export const GLASS_QUIET = "text-scrim-ink/70";
