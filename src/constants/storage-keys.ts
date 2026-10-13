/**
 * Every key this app writes to the browser's local storage.
 *
 * Gathered here so a new one cannot collide with an existing one, and so the
 * set is readable in one place.
 *
 * NOTE the two spellings below. `shotAndShare:` is the odd one out - everything
 * else uses `shot-and-share:`. It is kept as it is on purpose: the string is
 * already in real browsers, and changing it would orphan a host's unsaved
 * appearance edits. Worth migrating one day, with a read of the old key first.
 */

/** A guest's favourites, one list per share link. */
export const FAVORITES_PREFIX = "shot-and-share:favorites:";

/** A host's unsaved appearance edits, one per event. */
export const APPEARANCE_DRAFT_PREFIX = "shotAndShare:appearance:";

/** The random id a guest's uploads are grouped by. */
export const FINGERPRINT_KEY = "shot-and-share:fingerprint";

/** Marks an event link as already opened on this device. */
export const OPENED_PREFIX = "shot-and-share:opened:";

