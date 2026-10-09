import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { publicImageType } from "@/lib/media";
import {
  IMMUTABLE_CACHE_CONTROL,
  REPLACEABLE_CACHE_CONTROL,
} from "@/lib/storage/types";

/**
 * The CDN has two halves and they are in different languages: the application
 * decides what a public object is in TypeScript, and the distribution decides
 * it again at the edge in a CloudFront Function. Nothing makes them agree
 * except this file.
 *
 * It matters because the two disagree in opposite directions. An edge function
 * stricter than the app shows a broken image on every tile; one looser than the
 * app serves a 30 GB wedding archive, or full-size video that is meant to stay
 * behind an expiring signature, to anyone who can build the URL.
 */

/** The allowlist the edge actually ships, read out of the deployed source. */
function edgeAllowlist(): RegExp {
  const source = readFileSync(
    path.join(process.cwd(), "infra/cloudfront-viewer-request.js"),
    "utf8",
  );
  // The one regex literal assigned to `allowed` in that file.
  const found = /var allowed\s*=\s*(\/.+\/[a-z]*);/.exec(source);
  if (!found) throw new Error("no `allowed` regex in the viewer-request function");

  const body = found[1];
  const lastSlash = body.lastIndexOf("/");
  return new RegExp(body.slice(1, lastSlash), body.slice(lastSlash + 1));
}

const OWNER = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const MEDIA = "33333333-3333-4333-8333-333333333333";

/** Everything a gallery legitimately loads, and everything it must not. */
const KEYS = [
  `${OWNER}/${EVENT}/photos/thumb/${MEDIA}.webp`,
  `${OWNER}/${EVENT}/photos/full/${MEDIA}.jpg`,
  `${OWNER}/${EVENT}/photos/full/${MEDIA}.jpeg`,
  `${OWNER}/${EVENT}/videos/poster/${MEDIA}.webp`,
  // Written before the photos/videos split, read off the row, never migrated.
  `${OWNER}/${EVENT}/full/${MEDIA}.jpg`,
  `${OWNER}/${EVENT}/thumb/${MEDIA}.webp`,
  `${OWNER}/${EVENT}/${MEDIA}-poster.webp`,
  // The two that must never be served from a stable URL.
  `${OWNER}/${EVENT}/archive/${EVENT}.zip`,
  `${OWNER}/${EVENT}/videos/full/${MEDIA}.mp4`,
  // Neither a gallery image nor inside the owner-scoped layout.
  `${OWNER}/${EVENT}/photos/full/${MEDIA}.svg`,
  `${OWNER}/${EVENT}/photos/full/${MEDIA}`,
  `${OWNER}/${MEDIA}.jpg`,
  "",
];

describe("the edge agrees with the application about what is public", () => {
  const allowed = edgeAllowlist();

  it.each(KEYS)("decides %s the same way", (key) => {
    // The function sees a request URI, which carries a leading slash.
    expect(allowed.test(`/${key}`)).toBe(publicImageType(key) !== null);
  });

  it("refuses the archive and full-size video, which is the whole point", () => {
    expect(allowed.test(`/${OWNER}/${EVENT}/archive/${EVENT}.zip`)).toBe(false);
    expect(allowed.test(`/${OWNER}/${EVENT}/videos/full/${MEDIA}.mp4`)).toBe(
      false,
    );
  });

  it("serves the thumbnail, which is what a wall of fifty tiles loads", () => {
    expect(allowed.test(`/${OWNER}/${EVENT}/photos/thumb/${MEDIA}.webp`)).toBe(
      true,
    );
  });
});

describe("the distribution keeps photographs out of image search", () => {
  /**
   * `next.config.ts` sets X-Robots-Tag on /api/:path*, which is what stops a
   * wedding photograph being indexed while media is served by the app. Served
   * from CloudFront the app's headers are not involved, so the header has to be
   * on the distribution instead - and its absence is invisible until a
   * photograph turns up in an image search.
   */
  it("carries a noindex response header policy", () => {
    const policy = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "infra/cloudfront-response-headers.json"),
        "utf8",
      ),
    );

    const headers = policy.CustomHeadersConfig.Items as {
      Header: string;
      Value: string;
      Override: boolean;
    }[];
    const robots = headers.find(
      (h) => h.Header.toLowerCase() === "x-robots-tag",
    );

    expect(robots).toBeDefined();
    expect(robots!.Value).toContain("noindex");
    expect(robots!.Value).toContain("noimageindex");
    expect(robots!.Override).toBe(true);
  });
});

describe("cache headers", () => {
  /**
   * Without this header on the object a CDN falls back to its own default TTL
   * and every browser revalidates a photograph that cannot have changed. It is
   * the difference between a gallery served from an edge and one that asks the
   * bucket about every tile.
   */
  it("lets a freshly keyed object be cached for a year", () => {
    expect(IMMUTABLE_CACHE_CONTROL).toContain("max-age=31536000");
    expect(IMMUTABLE_CACHE_CONTROL).toContain("immutable");
  });

  it("never calls a rewritable object immutable", () => {
    // The transcode worker replaces a file in place when the format it is
    // converting to is the one the key already names, so these cannot claim it.
    expect(REPLACEABLE_CACHE_CONTROL).not.toContain("immutable");
  });
});

describe("purging a deleted photograph", () => {
  /*
   * The exposure this closes: stored objects carry a year-long immutable cache
   * header, so without a purge a deleted photograph stays readable at every
   * edge that served it - for longer than the 72-hour takedown the product
   * promises in writing.
   */
  const KEYS = [
    `${OWNER}/${EVENT}/photos/full/${MEDIA}.jpg`,
    `${OWNER}/${EVENT}/photos/thumb/${MEDIA}.webp`,
  ];

  /** A fresh copy of the module with the environment it should read. */
  async function withEnv(vars: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.resetModules();
    return import("@/lib/cdn/purge");
  }

  afterEach(() => {
    delete process.env.CDN_PROVIDER;
    delete process.env.CDN_API_KEY;
    delete process.env.CDN_DISTRIBUTION_ID;
    delete process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
    vi.unstubAllGlobals();
  });

  it("says which variable is missing rather than failing obscurely", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    // A provider named but no hostname to purge at: half-configured, which is
    // what a deployment looks like midway through being switched over.
    const { purge } = await withEnv({
      CDN_PROVIDER: "bunny",
      CDN_API_KEY: "key",
      NEXT_PUBLIC_MEDIA_BASE_URL: undefined,
    });
    await purge(KEYS);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(String(logged.mock.calls[0]?.[0])).toContain(
      "NEXT_PUBLIC_MEDIA_BASE_URL",
    );
    logged.mockRestore();
  });

  it("does nothing when no CDN is configured, which is every laptop", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { purge } = await withEnv({ CDN_PROVIDER: undefined });
    await purge(KEYS);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads an unrecognised provider as none rather than guessing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { purge } = await withEnv({ CDN_PROVIDER: "cloudfrnot" });
    await purge(KEYS);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks the CDN to forget every object the photograph owned", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    const { purge } = await withEnv({
      CDN_PROVIDER: "bunny",
      CDN_API_KEY: "key",
      NEXT_PUBLIC_MEDIA_BASE_URL: "https://media.example.com",
    });
    await purge(KEYS);

    expect(fetchSpy).toHaveBeenCalledTimes(KEYS.length);
    // The full copy and the thumbnail both go: a wall loads the thumbnail, so
    // purging only the full copy would leave the photograph on the grid.
    const asked = fetchSpy.mock.calls.map((call) => String(call[0]));
    for (const key of KEYS) {
      expect(asked.some((url) => url.includes(encodeURIComponent(key)))).toBe(
        true,
      );
    }
  });

  it("deletes a whole event with one wildcard, not one path per photo", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    const { purgePrefix } = await withEnv({
      CDN_PROVIDER: "bunny",
      CDN_API_KEY: "key",
      NEXT_PUBLIC_MEDIA_BASE_URL: "https://media.example.com",
    });
    await purgePrefix(`${OWNER}/${EVENT}/`);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain(
      encodeURIComponent(`${OWNER}/${EVENT}/*`),
    );
  });

  it("never throws, because the object has already gone", async () => {
    // By the time a purge runs the bytes are out of the bucket. A provider
    // having an afternoon must not turn a successful delete into an error the
    // caller would have to unwind.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { purge } = await withEnv({
      CDN_PROVIDER: "bunny",
      CDN_API_KEY: "key",
      NEXT_PUBLIC_MEDIA_BASE_URL: "https://media.example.com",
    });
    await expect(purge(KEYS)).resolves.toBeUndefined();

    // Logged loudly, though: a purge failing at every event is an operator
    // problem, and a silent catch is how it stays invisible for a month.
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("treats a provider's error status as a failure, not a success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { purge } = await withEnv({
      CDN_PROVIDER: "bunny",
      CDN_API_KEY: "wrong",
      NEXT_PUBLIC_MEDIA_BASE_URL: "https://media.example.com",
    });
    await purge(KEYS);

    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe("the config files the AWS CLI applies", () => {
  /*
   * `aws s3api put-bucket-cors` and `put-bucket-lifecycle-configuration`
   * validate their JSON against the API's own input shape and reject anything
   * they do not recognise. A `_comment` key - which both of these files used to
   * carry, as documentation - fails the entire command before a single byte
   * leaves the machine:
   *
   *   Unknown parameter in CORSConfiguration.CORSRules[0]: "_comment"
   *
   * Nobody noticed because neither file had ever been applied. The explanations
   * moved into infra/guides/, which is where they are useful anyway, and this
   * is what stops somebody helpfully annotating the JSON again.
   */
  const APPLIED = [
    "infra/s3-cors.json",
    "infra/s3-lifecycle.json",
    "infra/cloudfront-response-headers.json",
  ];

  function read(name: string): unknown {
    return JSON.parse(readFileSync(path.join(process.cwd(), name), "utf8"));
  }

  /** Every key anywhere in the structure. */
  function keysOf(node: unknown): string[] {
    if (Array.isArray(node)) return node.flatMap(keysOf);
    if (node && typeof node === "object") {
      return Object.entries(node).flatMap(([k, v]) => [k, ...keysOf(v)]);
    }
    return [];
  }

  it.each(APPLIED)("%s is valid JSON", (name) => {
    expect(() => read(name)).not.toThrow();
  });

  it.each(APPLIED)("%s carries no key the AWS CLI would reject", (name) => {
    const rejected = keysOf(read(name)).filter(
      (key) => key.startsWith("_") || key.toLowerCase() === "comments",
    );
    expect(rejected).toEqual([]);
  });

  it("still keeps every CORS origin the app is served from", () => {
    // Stripping the comments must not have taken an origin with it: a missing
    // hostname here is an upload that fails silently in production.
    const cors = read("infra/s3-cors.json") as {
      CORSRules: { AllowedOrigins: string[]; AllowedMethods: string[] }[];
    };
    const origins = cors.CORSRules[0].AllowedOrigins;

    expect(origins).toContain("https://shotandshare.com");
    expect(origins).toContain("http://localhost:3000");
    // POST is the upload itself; without it every guest upload is blocked.
    expect(cors.CORSRules[0].AllowedMethods).toContain("POST");
    // A bare wildcard would let any page use our upload policy.
    expect(origins).not.toContain("*");
  });

  it("has the two lifecycle rules and no Deep Archive transition", () => {
    const lifecycle = read("infra/s3-lifecycle.json") as {
      Rules: { ID: string; Status: string; Transitions?: { StorageClass: string }[] }[];
    };
    expect(lifecycle.Rules.map((r) => r.ID)).toEqual([
      "media-to-glacier-ir-after-30-days",
      "expire-generated-archives",
    ]);
    expect(lifecycle.Rules.every((r) => r.Status === "Enabled")).toBe(true);
  });

  /*
   * Deep Archive takes 12 to 48 hours to read and needs a restore request per
   * object, which nothing in this codebase can issue - `RestoreObject` appears
   * nowhere. A rule that moved gallery photographs there would turn a paid
   * event page into broken images about thirteen months after purchase.
   *
   * It is asserted rather than merely deleted because the rule it replaces
   * never fired by accident: the tag it filtered on was never written, so
   * "fixing" that tag would have armed it. See infra/guides/lifecycle.md.
   */
  it("never sends a gallery photograph anywhere that needs thawing", () => {
    const lifecycle = read("infra/s3-lifecycle.json") as {
      Rules: { Transitions?: { StorageClass: string }[] }[];
    };
    const classes = lifecycle.Rules.flatMap(
      (r) => r.Transitions?.map((t) => t.StorageClass) ?? [],
    );

    expect(classes).not.toContain("DEEP_ARCHIVE");
    expect(classes).not.toContain("GLACIER");
    // Instant Retrieval is the one that reads back in milliseconds.
    expect(classes).toEqual(["GLACIER_IR"]);
  });
});
