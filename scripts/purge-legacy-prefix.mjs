/**
 * One-shot: delete everything left under a superseded key prefix.
 * Migration 0008 moved objects out of `u/{owner_id}/...`.
 */

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const PREFIX = process.argv.find((a) => a.startsWith("--prefix="))?.slice(9) ?? "u/";

const confirm = process.argv.includes("--confirm");
const bucket = process.env.S3_BUCKET;

if (!bucket) {
  console.error("S3_BUCKET is not set. Nothing to do.");
  process.exit(1);
}

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "eu-central-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

let scanned = 0;
let deleted = 0;
let token;

console.log(
  confirm
    ? `Deleting everything under s3://${bucket}/${PREFIX}`
    : `Dry run. Listing s3://${bucket}/${PREFIX} - pass --confirm to delete.`,
);

do {
  const listed = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: PREFIX,
      ContinuationToken: token,
    }),
  );

  const keys = (listed.Contents ?? []).map((o) => o.Key).filter(Boolean);
  scanned += keys.length;

  if (keys.length > 0 && confirm) {
    // DeleteObjects caps at 1000 keys per call, which is also ListObjectsV2's page size
    // - so one page is always one delete.
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    deleted += keys.length;
  } else {
    for (const key of keys.slice(0, 10)) console.log(`  ${key}`);
    if (keys.length > 10) console.log(`  ... and ${keys.length - 10} more`);
  }

  token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
} while (token);

console.log(
  confirm
    ? `Done. ${deleted} object(s) deleted.`
    : `Done. ${scanned} object(s) would be deleted.`,
);
