import "server-only";

import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";

import { env } from "@/lib/env";

/**
 * Telling the CDN to forget a photograph that has been deleted.
 *
 * This is not an optimisation. Stored objects now carry
 * `Cache-Control: public, max-age=31536000, immutable`, which is correct - no
 * key is ever rewritten - but "never rewritten" is not "never deleted". Without
 * a purge, a photograph removed by its guest, taken down by its host, or
 * removed on request goes on being served from every edge that holds a copy,
 * for up to a year.
 *
 * The product promises faster than that, in writing: a reported photo is
 * "hidden at once", and a takedown is answered within
 * `TAKEDOWN_RESPONSE_HOURS`. Deleting the object satisfies the database and the
 * bucket. The cached copy is the part that outlives the promise, and the person
 * asking for a takedown is by definition someone who has seen the photograph
 * and may still hold its URL.
 *
 * So a CDN without this wired up is strictly worse than no CDN: the same
 * year-long window, now copied to every location that served the file.
 *
 * **Never throws.** By the time this runs the object is already gone from the
 * bucket, so a failed purge must not turn a successful delete into an error the
 * caller has to undo. Same best-effort posture as `release()` in
 * `@/lib/storage/quota` - logged loudly, because a purge failing at every event
 * is an operator problem and a silent catch is how it stays invisible.
 */

let client: CloudFrontClient | null = null;

function cloudfront(): CloudFrontClient {
  if (!client) {
    client = new CloudFrontClient({
      // CloudFront's control plane is global and signs against us-east-1,
      // whatever region the bucket is in.
      region: "us-east-1",
      credentials: {
        accessKeyId: env.s3.accessKeyId!,
        secretAccessKey: env.s3.secretAccessKey!,
      },
    });
  }
  return client;
}

/**
 * A purge path is the storage key with a leading slash, which is what both
 * providers address an object by.
 */
function asPath(key: string): string {
  return key.startsWith("/") ? key : `/${key}`;
}

async function purgeCloudFront(paths: string[]): Promise<void> {
  await cloudfront().send(
    new CreateInvalidationCommand({
      DistributionId: env.cdn.distributionId,
      InvalidationBatch: {
        // The caller's own identifier would have to be unique per call; the
        // clock plus a random suffix is what the API actually wants here.
        CallerReference: `purge-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        Paths: { Quantity: paths.length, Items: paths },
      },
    }),
  );
}

async function purgeBunny(paths: string[]): Promise<void> {
  const base = env.mediaBaseUrl!.replace(/\/$/, "");

  /*
   * Bunny purges one URL per request and has no batch endpoint, so a deleted
   * photograph is three calls - the file, its thumbnail and a video's poster.
   * They are independent, so they go together rather than in series.
   */
  const results = await Promise.allSettled(
    paths.map((path) =>
      fetch(
        `https://api.bunny.net/purge?url=${encodeURIComponent(base + path)}&async=false`,
        { method: "POST", headers: { AccessKey: env.cdn.apiKey! } },
      ).then((res) => {
        if (!res.ok) throw new Error(`bunny purge ${res.status}`);
      }),
    ),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    throw new Error(`${failed.length} of ${paths.length} purges failed`);
  }
}

/**
 * Forget these objects at the edge.
 *
 * Takes storage keys, not URLs, so every caller can hand over exactly what it
 * just deleted - `mediaKeys(row)` returns the file, its thumbnail and a clip's
 * poster, and all three have to go.
 */
export async function purge(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await send(keys.map(asPath));
}

/**
 * Forget everything under a prefix, in one operation.
 *
 * Deleting a whole event is one wildcard rather than three paths per
 * photograph, which matters on CloudFront: invalidation paths are metered past
 * the first thousand a month, and a wedding is a thousand paths on its own.
 */
export async function purgePrefix(prefix: string): Promise<void> {
  await send([`${asPath(prefix).replace(/\/$/, "")}/*`]);
}

/**
 * What is missing before a purge can even be attempted, or null when nothing
 * is.
 *
 * Checked up front so a half-configured deployment says which variable it
 * wants. Without this the symptom is a `TypeError` on a non-null assertion,
 * logged once per deleted photograph, which reads like a bug in the purge
 * rather than a blank field in the environment.
 */
function misconfigured(provider: "cloudfront" | "bunny"): string | null {
  if (provider === "cloudfront") {
    return env.cdn.distributionId ? null : "CDN_DISTRIBUTION_ID";
  }
  if (!env.cdn.apiKey) return "CDN_API_KEY";
  // Bunny purges by URL, so it needs to know the hostname the object is at.
  return env.mediaBaseUrl ? null : "NEXT_PUBLIC_MEDIA_BASE_URL";
}

async function send(paths: string[]): Promise<void> {
  const provider = env.cdn.provider;
  // No CDN configured: objects are served by the app, which holds no cache of
  // its own beyond the optimiser. Every laptop and preview runs in this state.
  if (!provider) return;

  const missing = misconfigured(provider);
  if (missing) {
    console.error(
      `[cdn] ${provider} purge skipped: ${missing} is not set. Deleted photographs stay cached until it is.`,
    );
    return;
  }

  try {
    if (provider === "cloudfront") await purgeCloudFront(paths);
    else await purgeBunny(paths);
  } catch (error) {
    console.error(
      `[cdn] ${provider} purge failed for ${paths.length} path(s)`,
      paths.slice(0, 5),
      error,
    );
  }
}
