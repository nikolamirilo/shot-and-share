/**
 * Delete objects no database row points at. Postgres is the source of truth for
 * what exists; anything in the bucket nothing references is a leftover.
 */

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const CONFIRM = flag("confirm");
const PREFIX = value("prefix");
const MAX_SHARE = Number(value("max-share") ?? 10);
const INCLUDE_FOREIGN = flag("include-foreign");
const FORCE = flag("force");

const bucket = process.env.S3_BUCKET;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!bucket) {
  console.error("S3_BUCKET is not set. Nothing to do.");
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or " +
      "SUPABASE_SERVICE_ROLE_KEY) are required - without the database there " +
      "is no way to tell a photograph from garbage.",
  );
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

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Keyset pagination on the primary key, so updates shifting rows cannot make the cursor
 * re-read them.
 */
async function referencedKeys() {
  const live = new Set();
  const softDeleted = new Set();

  let cursor = "00000000-0000-0000-0000-000000000000";
  let rows = 0;
  for (;;) {
    const { data, error } = await db
      .from("media")
      .select("id, status, media_key, thumb_key, poster_key")
      .gt("id", cursor)
      .order("id", { ascending: true })
      .limit(500);
    if (error) throw new Error(`Reading media failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      rows++;
      const into = row.status === "deleted" ? softDeleted : live;
      for (const key of [row.media_key, row.thumb_key, row.poster_key]) {
        if (key) into.add(key);
      }
    }
    cursor = data[data.length - 1].id;
  }

  // A reservation is an upload in flight: its object may not exist yet, and if it does
  // it belongs to a guest who is still uploading.
  let reservations = 0;
  cursor = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const { data, error } = await db
      .from("upload_reservations")
      .select("id, media_key, thumb_key, poster_key")
      .gt("id", cursor)
      .order("id", { ascending: true })
      .limit(500);
    if (error) throw new Error(`Reading reservations failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      reservations++;
      for (const key of [row.media_key, row.thumb_key, row.poster_key]) {
        if (key) live.add(key);
      }
    }
    cursor = data[data.length - 1].id;
  }

  let events = 0;
  cursor = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const { data, error } = await db
      .from("events")
      .select("id, archive_key")
      .gt("id", cursor)
      .order("id", { ascending: true })
      .limit(500);
    if (error) throw new Error(`Reading events failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      events++;
      if (row.archive_key) live.add(row.archive_key);
    }
    cursor = data[data.length - 1].id;
  }

  // A soft-deleted row's key only counts as mentioned if nothing live claims it, so a
  // re-used key is never reported as a failed delete.
  for (const key of live) softDeleted.delete(key);

  return { live, softDeleted, counts: { rows, reservations, events } };
}

// Is this key laid out as {owner}/{event}/…, or something else entirely?
const isEventKey = (key) => /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/.+/i.test(key);

console.log(
  CONFIRM
    ? `Purging unreferenced objects from s3://${bucket}${PREFIX ? `/${PREFIX}` : ""}.`
    : `Dry run against s3://${bucket}${PREFIX ? `/${PREFIX}` : ""}. Nothing is deleted - pass --confirm.`,
);

const { live, softDeleted, counts } = await referencedKeys();
console.log(
  `\nThe database mentions ${live.size} key(s), from ${counts.rows} media row(s), ` +
    `${counts.reservations} reservation(s) and ${counts.events} event(s).`,
);

if (live.size === 0) {
  console.error(
    "\nThe database mentions no keys at all. That is either an empty " +
      "deployment or a failed query, and the two are indistinguishable from " +
      "here - so nothing is deleted. Check the connection and try again.",
  );
  process.exit(1);
}

let listed = 0;
const orphans = [];
const foreign = [];
const failedDeletes = [];
let token;

do {
  const page = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: PREFIX,
      ContinuationToken: token,
    }),
  );

  for (const object of page.Contents ?? []) {
    const key = object.Key;
    if (!key) continue;
    listed++;

    if (live.has(key)) continue;

    if (softDeleted.has(key)) {
      failedDeletes.push({ key, size: object.Size ?? 0 });
      continue;
    }

    // A key ending in a slash is a zero-byte marker the console creates. It can never
    // be referenced, and it is what keeps an emptied folder showing up.
    const target = isEventKey(key) || key.endsWith("/") ? orphans : foreign;
    target.push({ key, size: object.Size ?? 0 });
  }

  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

const doomed = INCLUDE_FOREIGN ? [...orphans, ...foreign] : orphans;
const doomedBytes = doomed.reduce((sum, o) => sum + o.size, 0);

console.log(`\nListed ${listed} object(s).`);

function show(label, items) {
  if (items.length === 0) return;
  const total = items.reduce((sum, o) => sum + o.size, 0);
  console.log(`\n${label}: ${items.length} object(s), ${mb(total)}`);
  const folders = new Map();
  for (const { key } of items) {
    const folder = key.slice(0, key.lastIndexOf("/") + 1);
    folders.set(folder, (folders.get(folder) ?? 0) + 1);
  }
  for (const [folder, n] of [...folders].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(n).padStart(5)}  ${folder}`);
  }
  if (folders.size > 20) console.log(`  ... and ${folders.size - 20} more folder(s)`);
}

show("Unreferenced, inside an event", orphans);
show(
  INCLUDE_FOREIGN
    ? "Not event data, and included"
    : "Not event data, left alone (--include-foreign to purge)",
  foreign,
);

if (failedDeletes.length > 0) {
  const total = failedDeletes.reduce((sum, o) => sum + o.size, 0);
  console.log(
    `\nStill referenced by a deleted row: ${failedDeletes.length} object(s), ${mb(total)}`,
  );
  console.log(
    "  These are objects a delete should have removed. Reported, not purged -\n" +
      "  the database still mentions them, so something is wrong upstream.",
  );
  for (const { key } of failedDeletes.slice(0, 5)) console.log(`    ${key}`);
}

if (doomed.length === 0) {
  console.log("\nNothing to purge.");
  process.exit(0);
}

const share = (doomed.length / listed) * 100;
console.log(
  `\n${doomed.length} object(s), ${mb(doomedBytes)} - ${share.toFixed(1)}% of what was listed.`,
);

if (share > MAX_SHARE && !FORCE) {
  console.error(
    `\nThat is more than ${MAX_SHARE}% of the bucket, which is the shape of a\n` +
      "half-read database rather than a bucket full of garbage. Nothing has\n" +
      "been deleted. Read the list above; if it is genuinely all junk, re-run\n" +
      "with --force, or narrow it with --prefix.",
  );
  process.exit(1);
}

if (!CONFIRM) {
  console.log("\nDry run. Re-run with --confirm to delete.");
  process.exit(0);
}

let deleted = 0;
for (let i = 0; i < doomed.length; i += 1000) {
  const chunk = doomed.slice(i, i + 1000);
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: chunk.map(({ key }) => ({ Key: key })), Quiet: true },
    }),
  );
  deleted += chunk.length;
}

console.log(`\nDone. ${deleted} object(s) deleted, ${mb(doomedBytes)} freed.`);
