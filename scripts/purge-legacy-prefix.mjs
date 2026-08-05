/**
 * One-shot: delete everything left under the pre-0007 `events/` prefix.
 *
 * Migration 0007 moved objects to `u/{owner_id}/{event_id}/...` and dropped the
 * media rows that pointed at the old layout. Postgres is the source of truth
 * for what exists, so those objects are now unreferenced - but S3 bills for
 * them all the same, and nothing else will ever go looking.
 *
 * Deliberately standalone rather than importing the storage driver: it is a
 * destructive maintenance job that runs once, and it should not be able to
 * break because an unrelated module in the application changed.
 *
 *   node scripts/purge-legacy-prefix.mjs            # dry run, lists only
 *   node scripts/purge-legacy-prefix.mjs --confirm  # actually deletes
 */

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const PREFIX = "events/";

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
    // DeleteObjects caps at 1000 keys per call, which is also the page size
    // ListObjectsV2 returns, so one page is always one delete.
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
