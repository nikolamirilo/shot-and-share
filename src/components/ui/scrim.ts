/**
 * The colours of anything sitting on the dark scrim: the lightbox's buttons,
 * its arrows, and the report sheet inside it.
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
 * The same pair for a control that sits over a photograph rather than over the
 * scrim - the step arrows. A pale chip on a pale photograph needs an edge, and
 * the shadow is what gives it one.
 */
export const ON_SCRIM_FLOATING = `${ON_SCRIM} shadow-lg`;

/**
 * The quiet register on the same scrim: the photo counter, the note about a
 * video still converting. Dark pill, light type - the inverse of a control, so
 * a label never competes with a button for attention on top of a photograph.
 */
export const ON_SCRIM_QUIET = "bg-scrim-ink/72 text-scrim";
