export const START: Stages = { prepare: 0, upload: 0, confirmed: false };

export interface Stages {
  prepare: number;
  upload: number;
  confirmed: boolean;
}

const WEIGHT = {
  photo: { prepare: 0.2, upload: 0.75 },
  video: { prepare: 0.03, upload: 0.92 },
} as const;

export type FileKind = keyof typeof WEIGHT;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function fileFraction(stages: Stages, kind: FileKind = "photo"): number {
  if (stages.confirmed) return 1;
  const weight = WEIGHT[kind];
  return (
    clamp01(stages.prepare) * weight.prepare +
    clamp01(stages.upload) * weight.upload
  );
}

export function runPercent(
  files: readonly { bytes: number; stages: Stages; kind?: FileKind }[],
): number {
  if (files.length === 0) return 0;

  // A floor per file, so a zero-byte pick cannot divide the whole bar by nothing.
  const weightOf = (bytes: number) => Math.max(1, bytes);

  const total = files.reduce((sum, f) => sum + weightOf(f.bytes), 0);
  const done = files.reduce(
    (sum, f) => sum + weightOf(f.bytes) * fileFraction(f.stages, f.kind),
    0,
  );

  return Math.round((done / total) * 100);
}
