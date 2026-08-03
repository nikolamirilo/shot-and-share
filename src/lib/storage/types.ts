import type { Readable } from "node:stream";

/**
 * Presigned upload, expressed as a POST rather than a PUT.
 *
 * A presigned PUT cannot enforce a maximum size — the signature covers the key
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
  }): Promise<void>;

  getStream(key: string): Promise<Readable>;

  head(key: string): Promise<{ size: number } | null>;

  remove(keys: string[]): Promise<void>;

  /** Used only by the retention job, which deletes a whole event prefix. */
  removePrefix(prefix: string): Promise<number>;
}
