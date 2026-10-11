import type { Readable } from "node:stream";

/**
 * Presigned upload, expressed as a POST rather than a PUT.
 *
 * A presigned PUT cannot enforce a maximum size - the signature covers the key
 * and the method, not the body length. A POST carries a `content-length-range`
 * condition that S3 itself rejects on.
 */
export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  // Name of the form field carrying the bytes. Always last in the FormData.
  fileField: string;
}

/**
 * Every signed key carries a freshly minted media id, so no object is ever rewritten
 * under it - which is what `immutable` asks for.
 */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * The transcode worker can replace a file in place when the format it converts to is
 * the one the key already names, so these cannot claim to be immutable.
 */
export const REPLACEABLE_CACHE_CONTROL = "public, max-age=86400";

export interface StorageDriver {
  readonly name: "s3" | "local";

  presignUpload(args: {
    key: string;
    contentType: string;
    maxBytes: number;
    expiresInSeconds?: number;
    tags?: Record<string, string>;
    cacheControl?: string;
  }): Promise<PresignedUpload>;

  presignDownload(args: {
    key: string;
    expiresInSeconds?: number;
    downloadName?: string;
  }): Promise<string>;

  publicUrl(key: string): string | null;

  put(args: {
    key: string;
    body: Buffer | Readable;
    contentType: string;
    contentLength?: number;
    tags?: Record<string, string>;
    cacheControl?: string;
  }): Promise<void>;

  getStream(key: string): Promise<Readable>;

  head(key: string): Promise<{ size: number } | null>;

  remove(keys: string[]): Promise<void>;

  removePrefix(prefix: string): Promise<number>;
}
