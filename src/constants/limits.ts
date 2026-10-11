/**
 * The rate-limit policies. Separated from the counting in @/lib/ratelimit so
 * the numbers can be read, and changed, without reading the algorithm.
 *
 * On serverless these counters are per instance and reset on cold start, so
 * treat the numbers as a second line of defence, not a guarantee.
 */

export const LIMITS = {
  presign: { limit: 4 * 300, window: 60 },
  guestPage: { limit: 60, window: 60 },
  report: { limit: 10, window: 3600 },
  coverUpload: { limit: 10, window: 60 },
  archive: { limit: 5, window: 3600 },
  createEvent: { limit: 20, window: 3600 },
  signIn: { limit: 10, window: 300 },
  signUp: { limit: 5, window: 3600 },
  passwordReset: { limit: 5, window: 3600 },
} as const;
