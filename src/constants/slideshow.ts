/** How long each photograph is held on the projector. */
export const ADVANCE_MS = 7000;

/** How often the slideshow asks for new arrivals while it is keeping up. */
export const POLL_LIVE_MS = 60_000;

/** How often it asks after a request that did not land. */
export const POLL_OFFLINE_MS = 10_000;

/** How long the cursor and chrome stay before fading on an untouched screen. */
export const IDLE_MS = 3_000;

/** A bound on paging back through a long evening. */
export const MAX_BACKFILL_PAGES = 200;
