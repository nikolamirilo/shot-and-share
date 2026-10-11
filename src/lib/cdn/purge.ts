import "server-only";

import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";

import { env } from "@/lib/env";

let client: CloudFrontClient | null = null;

function cloudfront(): CloudFrontClient {
  if (!client) {
    client = new CloudFrontClient({
      // CloudFront's control plane is global and signs against us-east-1.
      region: "us-east-1",
      credentials: {
        accessKeyId: env.s3.accessKeyId!,
        secretAccessKey: env.s3.secretAccessKey!,
      },
    });
  }
  return client;
}

function asPath(key: string): string {
  return key.startsWith("/") ? key : `/${key}`;
}

async function purgeCloudFront(paths: string[]): Promise<void> {
  await cloudfront().send(
    new CreateInvalidationCommand({
      DistributionId: env.cdn.distributionId,
      InvalidationBatch: {
        CallerReference: `purge-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        Paths: { Quantity: paths.length, Items: paths },
      },
    }),
  );
}

async function purgeBunny(paths: string[]): Promise<void> {
  const base = env.mediaBaseUrl!.replace(/\/$/, "");

  /** Bunny purges one URL per request and has no batch endpoint. */
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

export async function purge(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await send(keys.map(asPath));
}

export async function purgePrefix(prefix: string): Promise<void> {
  await send([`${asPath(prefix).replace(/\/$/, "")}/*`]);
}

function misconfigured(provider: "cloudfront" | "bunny"): string | null {
  if (provider === "cloudfront") {
    return env.cdn.distributionId ? null : "CDN_DISTRIBUTION_ID";
  }
  if (!env.cdn.apiKey) return "CDN_API_KEY";
  // Bunny purges by URL, so it needs the hostname the object is at.
  return env.mediaBaseUrl ? null : "NEXT_PUBLIC_MEDIA_BASE_URL";
}

async function send(paths: string[]): Promise<void> {
  const provider = env.cdn.provider;
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
