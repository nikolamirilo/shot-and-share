/**
 * Host reviews for the landing page.
 *
 * EMPTY ON PURPOSE until real ones exist. The redesign shows the section with
 * three example reviews (below, in `EXAMPLE_REVIEWS`) during development only,
 * so the layout can be judged; production renders the section only from this
 * array. Publishing invented reviews as if hosts wrote them is the one shortcut
 * this page must not take - ask hosts the morning after their ZIP download,
 * and add the answers here with their permission.
 */
export interface Review {
  stars: 1 | 2 | 3 | 4 | 5;
  text: string;
  /** First name and initial, as the host agreed to be named. */
  name: string;
  /** Event · city · month. */
  meta: string;
}

export const REVIEWS: Review[] = [];

/** Layout fillers for `next dev`. Never rendered in a production build. */
export const EXAMPLE_REVIEWS: Review[] = [
  {
    stars: 5,
    text: "Honestly thought half the guests wouldn't bother. We ended up with 900+ photos, loads from people I didn't even know had their phones out. Only tip: put a QR on every table, not just one at the bar.",
    name: "Marija K.",
    meta: "Wedding · Novi Sad · June",
  },
  {
    stars: 5,
    text: "My mum is 68 and she uploaded 40 photos on her own. Not one call asking me how. That's my review.",
    name: "Stefan P.",
    meta: "60th birthday · Belgrade · August",
  },
  {
    stars: 4,
    text: "Took Pro for our summer party. The slideshow on the projector was the hit of the night, people kept uploading just to get on screen. The ZIP for ~3k files took a few minutes to prepare, but everything was there.",
    name: "Ana M.",
    meta: "Company event · Zagreb · July",
  },
];
