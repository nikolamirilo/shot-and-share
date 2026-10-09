/**
 * CloudFront Function, viewer request. Attach to the default behaviour of the
 * media distribution.
 *
 * This is the edge copy of `publicImageType()` in `src/lib/media/keys.ts`, and
 * it exists for the same reason: Origin Access Control grants the distribution
 * read access to the *whole* bucket, so without this every key in it is
 * fetchable by anyone who can construct the URL.
 *
 * Two things in the bucket must never be served this way, and both sit under
 * the same event prefix as the photographs:
 *
 *   {owner}/{event}/archive/{event}.zip   the entire wedding in one file
 *   {owner}/{event}/videos/full/...       kept behind an expiring signature
 *                                         on purpose - the bytes are worth it
 *
 * The app refuses both on its own media route. A distribution that did not
 * would quietly undo that the day the hostname changed.
 *
 * Keep the folder list in step with `publicImageType`. If one of them learns
 * about a new rendition and the other does not, the symptom is a broken image
 * on every tile rather than anything that looks like a permissions problem.
 */

/* eslint-disable-next-line @typescript-eslint/no-unused-vars --
   CloudFront calls this by name; there is no export in its runtime. */
function handler(event) {
  var uri = event.request.uri;

  // {owner}/{event}/[folder/]{id}.{ext}, with the folder optional so posters
  // and rows written before the folders existed still resolve.
  var allowed =
    /^\/[^/]+\/[^/]+\/(?:(?:photos\/full|photos\/thumb|videos\/poster|full|thumb)\/)?[^/]+\.(?:webp|jpe?g|png|gif|avif)$/i;

  if (allowed.test(uri)) return event.request;

  return {
    statusCode: 403,
    statusDescription: "Forbidden",
    headers: {
      // Belt and braces: the response headers policy sets this too, but a
      // function response short-circuits before the origin is reached.
      "x-robots-tag": { value: "noindex, nofollow, noarchive, noimageindex" },
      "cache-control": { value: "public, max-age=300" },
    },
  };
}
