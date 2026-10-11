/** How many files are compressed at the same time. */
export const COMPRESS_AT_ONCE = 3;

/** How many files are sent at the same time. */
export const UPLOAD_AT_ONCE = 3;

/**
 * Not `sr-only`, `display: none` or `visibility: hidden`: all three have been
 * unreliable to open from script on iOS.
 */
export const HIDDEN_FILE_INPUT =
  "fixed bottom-0 left-0 -z-10 h-px w-px opacity-0";
