import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

import { env } from "@/lib/env";
import type { PresignedUpload, StorageDriver } from "@/lib/storage/types";

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint,
      forcePathStyle: Boolean(env.s3.endpoint),
      credentials: {
        accessKeyId: env.s3.accessKeyId!,
        secretAccessKey: env.s3.secretAccessKey!,
      },
    });
  }
  return client;
}

function bucket(): string {
  return env.s3.bucket!;
}

/** A presigned POST takes tags as XML, unlike the header form a PUT uses. */
function taggingXml(tags: Record<string, string>): string {
  const entries = Object.entries(tags)
    .map(
      ([key, value]) =>
        `<Tag><Key>${escapeXml(key)}</Key><Value>${escapeXml(value)}</Value></Tag>`,
    )
    .join("");
  return `<Tagging><TagSet>${entries}</TagSet></Tagging>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const s3Driver: StorageDriver = {
  name: "s3",

  async presignUpload({
    key,
    contentType,
    maxBytes,
    expiresInSeconds = 900,
    tags,
  }) {
    const tagging = tags ? taggingXml(tags) : null;

    const { url, fields } = await createPresignedPost(s3(), {
      Bucket: bucket(),
      Key: key,
      Expires: expiresInSeconds,
      Conditions: [
        // S3 itself rejects an oversized body. Our numbers are advisory until
        // this line makes them binding.
        ["content-length-range", 1, maxBytes],
        ["eq", "$Content-Type", contentType],
        ...(tagging
          ? [["eq", "$tagging", tagging] as ["eq", string, string]]
          : []),
      ],
      Fields: {
        "Content-Type": contentType,
        ...(tagging ? { tagging } : {}),
      },
    });

    return { url, fields, fileField: "file" } satisfies PresignedUpload;
  },

  async presignDownload({ key, expiresInSeconds = 300, downloadName }) {
    return getSignedUrl(
      s3(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        ResponseContentDisposition: downloadName
          ? `attachment; filename="${downloadName.replace(/"/g, "")}"`
          : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
  },

  /**
   * A CDN in front of the bucket when one is configured, and the app's own
   * media route when it is not.
   *
   * Never null, and that is the point: the caller's fallback is a signed URL
   * that expires in an hour, which is correct for a download and useless as the
   * input to an image optimiser - the URL changes, so every page load
   * re-transcodes the same photo. Both branches here are stable and cacheable.
   */
  publicUrl(key) {
    if (!env.mediaBaseUrl) return `/api/media/${key}`;
    return `${env.mediaBaseUrl.replace(/\/$/, "")}/${key}`;
  },

  async put({ key, body, contentType, contentLength, tags }) {
    // PutObject and CreateMultipartUpload take tags as a query string, unlike
    // the XML a presigned POST wants.
    const Tagging = tags
      ? new URLSearchParams(tags).toString()
      : undefined;

    if (Buffer.isBuffer(body)) {
      await s3().send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: contentLength ?? body.byteLength,
          Tagging,
        }),
      );
      return;
    }

    // A 30 GB archive cannot be buffered, so streams go through the multipart
    // uploader instead of a single PutObject.
    const upload = new Upload({
      client: s3(),
      params: {
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
        Tagging,
      },
      queueSize: 4,
      partSize: 16 * 1024 * 1024,
    });
    await upload.done();
  },

  async getStream(key) {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return res.Body as Readable;
  },

  async head(key) {
    try {
      const res = await s3().send(
        new HeadObjectCommand({ Bucket: bucket(), Key: key }),
      );
      return { size: res.ContentLength ?? 0 };
    } catch {
      return null;
    }
  },

  async remove(keys) {
    if (keys.length === 0) return;
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      await s3().send(
        new DeleteObjectsCommand({
          Bucket: bucket(),
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  },

  /**
   * LIST is billed at the expensive request rate, which is why the application
   * never uses it to read a gallery. Here it is the right tool: the retention
   * job runs once per event, at the very end of its life.
   */
  async removePrefix(prefix) {
    let deleted = 0;
    let token: string | undefined;

    do {
      const listed = await s3().send(
        new ListObjectsV2Command({
          Bucket: bucket(),
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      const keys = (listed.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k));

      if (keys.length > 0) {
        await this.remove(keys);
        deleted += keys.length;
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);

    return deleted;
  },
};
