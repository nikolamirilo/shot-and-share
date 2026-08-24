"use client";

import { estimate } from "@/lib/client/prepare";
import { formatBytes } from "@/lib/format";

/**
 * What to do with each file the guest just picked, decided before anything is
 * compressed or sent.
 *
 * File by file, not batch by batch. This used to be all-or-nothing: one clip
 * over the size limit and sixty photographs went nowhere. Now a file that
 * cannot go is named with the reason, and the rest go.
 *
 * There are two limits and no others. A file may not be bigger than the plan
 * allows, and the batch may not be bigger than the room left at the event.
 * There used to be a third - a cap on how many files one tap could take - and
 * it is gone: a guest emptying a camera roll after a wedding should hand over
 * everything they picked in one go, and the two limits that cost money are
 * the two that decide.
 *
 * Pure, so the arithmetic is testable without rendering a page - the same
 * reason `estimate` lives where it does.
 */

export interface Skipped {
  file: File;
  /** One sentence the guest can act on. */
  reason: string;
  /** Room is the host's problem, so a room refusal carries the upgrade hint. */
  upgrade?: boolean;
}

export interface Triage {
  accepted: File[];
  skipped: Skipped[];
}

export interface TriageLimits {
  maxFileBytes: number;
  /** Bytes still free at this event, after whatever this session already sent. */
  room: number;
}

export function triage(files: File[], limits: TriageLimits): Triage {
  const accepted: File[] = [];
  const skipped: Skipped[] = [];
  let room = limits.room;

  for (const file of files) {
    if (file.size > limits.maxFileBytes) {
      skipped.push({
        file,
        reason: `Bigger than ${formatBytes(limits.maxFileBytes, 0)}, which is the most we can take in one file.`,
      });
      continue;
    }

    // The server checks room again once it knows the real compressed size,
    // and its answer is the one that counts. This is only here so a file with
    // no chance of fitting is refused in half a second instead of after a
    // minute of compressing.
    const cost = estimate([file]);
    if (cost > room) {
      skipped.push({
        file,
        reason: "Not enough room left at this event for this one.",
        upgrade: true,
      });
      continue;
    }

    room -= cost;
    accepted.push(file);
  }

  return { accepted, skipped };
}
