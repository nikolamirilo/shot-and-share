"use client";

import { estimate } from "@/lib/client/prepare";
import { formatBytes } from "@/utils/format";

export interface Skipped {
  file: File;
  reason: string;
  upgrade?: boolean;
}

export interface Triage {
  accepted: File[];
  skipped: Skipped[];
}

export interface TriageLimits {
  maxFileBytes: number;
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

    // Advisory only - the server rechecks room against the real compressed size. This
    // is here so a hopeless file is refused in half a second.
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
