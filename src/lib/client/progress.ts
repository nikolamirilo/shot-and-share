/**
 * How full the bar is, as arithmetic with no React in it.
 *
 * It used to be one line in useUploadQueue - the average of a per-file number
 * that only ever meant "how much of the media object has been posted" - and it
 * produced a bar that filled to about a third, dropped to zero, jumped to a
 * half and then completed. Three separate faults, and all three are about the
 * *model* rather than the drawing:
 *
 *   1. The bar changed kind halfway through. It drifted while the batch was
 *      being encoded and switched to a real measurement the moment the first
 *      file started uploading - at which point the real measurement was still
 *      near zero, so a bar that looked 40% full became an empty one.
 *   2. Only the media object was measured. Encoding, the thumbnail and the
 *      confirm each took real time and moved nothing.
 *   3. The average was over file *count*, so two files gave a bar that could
 *      only read 0, 50 or 100 - and a 200 MB clip counted for exactly as much
 *      as a 2 MB photo.
 *
 * So a file's journey is modelled as three weighted stages that only ever move
 * forward, and the run is the byte-weighted sum of them. A bar that goes
 * backwards is worse than no bar at all: to a guest at a party it says their
 * photographs are being lost.
 */

/** Where every file starts. */
export const START: Stages = { prepare: 0, upload: 0, confirmed: false };

export interface Stages {
  /** 0 to 1. Encoding, which reports per encode rather than continuously. */
  prepare: number;
  /** 0 to 1. Bytes posted across every object this file stores. */
  upload: number;
  /** The media row exists. Only now is the photograph actually safe. */
  confirmed: boolean;
}

/**
 * What each stage is worth, out of one file - and it is not the same for a
 * photograph as for a clip.
 *
 * A photo is decoded, downscaled and encoded twice on the phone, which against
 * uploading a couple of megabytes is a real share of the wait. A clip is not
 * transcoded here at all: all the browser does is pull one poster frame out of
 * it, a second or two against minutes of upload. Weighting them the same put a
 * 200 MB clip at 21% before a single byte had left the phone, and then left it
 * crawling - which is its own kind of lie.
 *
 * The confirm keeps a sliver either way, so the bar cannot sit at 100 while a
 * photograph is still not written down.
 */
const WEIGHT = {
  photo: { prepare: 0.2, upload: 0.75 },
  video: { prepare: 0.03, upload: 0.92 },
} as const;

export type FileKind = keyof typeof WEIGHT;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** How far through its own journey one file is, from 0 to 1. */
export function fileFraction(stages: Stages, kind: FileKind = "photo"): number {
  if (stages.confirmed) return 1;
  const weight = WEIGHT[kind];
  return (
    clamp01(stages.prepare) * weight.prepare +
    clamp01(stages.upload) * weight.upload
  );
}

/**
 * The whole run as a percentage, 0 to 100.
 *
 * Weighted by bytes, because that is what the guest is actually waiting for.
 * A clip that is a hundred times the size of a photo is a hundred times the
 * wait, and a bar that treats them as equal spends most of its life wrong.
 */
export function runPercent(
  files: readonly { bytes: number; stages: Stages; kind?: FileKind }[],
): number {
  if (files.length === 0) return 0;

  // A floor per file so a zero-byte pick cannot make the total zero and divide
  // the whole bar by nothing.
  const weightOf = (bytes: number) => Math.max(1, bytes);

  const total = files.reduce((sum, f) => sum + weightOf(f.bytes), 0);
  const done = files.reduce(
    (sum, f) => sum + weightOf(f.bytes) * fileFraction(f.stages, f.kind),
    0,
  );

  return Math.round((done / total) * 100);
}
