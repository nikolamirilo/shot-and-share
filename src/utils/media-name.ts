/**
 * Naming for stored media, in one place.
 *
 * Three callers built this by hand - the event archive, the selected-photo
 * download, and the per-file download name - and they had already drifted:
 * two disagreed about the extension fallback, and the ZIP index was padded to
 * four digits in one and three in the other.
 *
 * Typed to the two fields it actually reads, so a caller selecting a narrow
 * row does not have to fetch a whole one to use it.
 */
interface NamedMedia {
  media_key: string;
  created_at: string;
}

/** The file extension of a stored object, from its key. */
export function mediaExt(row: NamedMedia, fallback = "jpg"): string {
  return row.media_key.split(".").pop() ?? fallback;
}

/** The upload time, flattened into something legal in a filename. */
export function mediaStamp(row: NamedMedia): string {
  return row.created_at.slice(0, 19).replace(/[:T]/g, "-");
}

/**
 * A numbered entry inside a ZIP: "0001-2026-06-13-21-04-00.jpg".
 *
 * `digits` is the caller's: a whole event may run to thousands of files, a
 * hand-picked selection rarely past a few hundred. Kept as an argument so
 * neither caller's existing filenames change.
 */
export function zipEntryName(
  row: NamedMedia,
  index: number,
  digits: number,
): string {
  return `${String(index + 1).padStart(digits, "0")}-${mediaStamp(row)}.${mediaExt(row)}`;
}
