export interface ModerationLabel {
  name: string;
  confidence: number;
  parent?: string;
}

export type ModerationOutcome = "clean" | "flagged" | "skipped" | "error";

export interface ModerationVerdict {
  allowed: boolean;
  outcome: ModerationOutcome;
  labels: ModerationLabel[];
  provider: string;
}

export interface ModerationDriver {
  readonly name: string;
  screen(key: string): Promise<ModerationVerdict>;
}
