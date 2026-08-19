/**
 * What a moderation driver has to answer, and nothing more.
 *
 * Deliberately small. The upload path needs one question answered - may this
 * appear without a person looking at it first - and everything else here exists
 * so a host staring at a held photograph can be told why it was held.
 */

export interface ModerationLabel {
  /** The provider's own category name, kept verbatim so it can be argued with. */
  name: string;
  /** 0 to 100. */
  confidence: number;
  /** The broader category it sits under, where the provider gives one. */
  parent?: string;
}

/**
 * Why a verdict came out the way it did.
 *
 * `skipped` and `error` both mean "nobody screened this", and they are separate
 * because one is a deployment without moderation configured and the other is a
 * provider that fell over. They lead to the same decision and to very different
 * conversations.
 */
export type ModerationOutcome = "clean" | "flagged" | "skipped" | "error";

export interface ModerationVerdict {
  /** False only when something actually fired. Never false on an error. */
  allowed: boolean;
  outcome: ModerationOutcome;
  /** Strongest first. Empty unless `outcome` is `flagged`. */
  labels: ModerationLabel[];
  /** Which driver answered, for the log and for the stored record. */
  provider: string;
}

export interface ModerationDriver {
  readonly name: string;
  /**
   * Screen one object already in storage.
   *
   * Takes a storage key rather than bytes: the file is in the bucket by the
   * time this is called, and handing a provider the key instead of the
   * megabytes is the difference between a round trip and three.
   *
   * Must never throw. A driver that cannot answer returns an `error` verdict
   * and the upload path decides what that means.
   */
  screen(key: string): Promise<ModerationVerdict>;
}
