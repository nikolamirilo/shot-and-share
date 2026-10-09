import type { Readable } from "node:stream";

/**
 * Presigned upload, expressed as a POST rather than a PUT.
 *
 * A presigned PUT cannot enforce a maximum size - the signature covers the key
 * and the method, not the body length, so a guest who ignores our numbers can
 * push a gigabyte into the bucket and we find out when the bill arrives. A
 * presigned POST carries a `content-length-range` condition that S3 itself
 * rejects on. Since the quota is the thing keeping this business solvent, the
 * enforcement belongs on the storage side, not in our client code.
 */
export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  /** Name of the form field carrying the bytes. Always last in the FormData. */
  fileField: string;
}

/**
 * What a freshly minted key is worth caching for: forever.
 *
 * Every key a guest upload is signed for carries a media id that has just been
 * generated, so no object is ever rewritten under it. That is the condition
 * `immutable` actually asks for, and without this header on the object a CDN
 * in front of the bucket falls back to its own default TTL and every browser
 * revalidates a photograph that cannot have changed.
 *
 * Set on the object at upload time rather than on the CDN behaviour, because
 * the object outlives any one distribution and the guarantee belongs with the
 * bytes.
 */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * What an object that *may* be rewritten under the same key is worth caching
 * for. The transcode worker replaces a file in place when the format it is
 * converting to is the one the key already names - an mp4 that still needs its
 * container rebuilt - so those cannot claim to be immutable.
 */
export const REPLACEABLE_CACHE_CONTROL = "public, max-age=86400";

export interface StorageDriver {
  readonly name: "s3" | "local";

  presignUpload(args: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds?: number;
    /**
     * Object tags, applied by the uploader as part of the signed policy. This
     * is what makes per-tier lifecycle rules possible without separate buckets,
     * and it costs no extra requests because the tag rides along with the PUT.
     */
    tags?: Record<string, string>;
    /**
     * `Cache-Control` for the stored object, applied by the uploader as part
     * of the signed policy.
     *
     * Worth passing on anything a gallery loads. A photograph served from a
     * CDN with no `Cache-Control` is cached for whatever the distribution's
     * default TTL happens to be and revalidated by every browser after that,
     * which on a wall of fifty tiles is fifty conditional requests for objects
     * that cannot have changed.
     */
    cacheControl?: string;
  }): Promise<PresignedUpload>;

  /** Short-lived read URL, so a leaked image link expires. */
  presignDownload(args: {
    key: string;
    expiresInSeconds?: number;
    downloadName?: string;
  }): Promise<string>;

  /**
   * Stable URL for objects served through the CDN. Thumbnails only: the URL
   * contains an unguessable id and the event link is already the access
   * control, so they can be cached hard and served without a signature.
   * Returns null when no media host is configured.
   */
  publicUrl(key: string): string | null;

  put(args: {
    key: string;
    body: Buffer | Readable;
    contentType: string;
    contentLength?: number;
    tags?: Record<string, string>;
    /** See `presignUpload`. Omitted on anything not served through the CDN. */
    cacheControl?: string;
  }): Promise<void>;

  getStream(key: string): Promise<Readable>;

  head(key: string): Promise<{ size: number } | null>;

  remove(keys: string[]): Promise<void>;

  /** Used only by the retention job, which deletes a whole event prefix. */
  removePrefix(prefix: string): Promise<number>;
}
