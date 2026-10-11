/**
 * One-shot: move every event's objects into the current key layout and point the
 * database rows at where they landed.
 */

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const CONFIRM = flag("confirm");
const ONE_EVENT = value("event");
const ONE_OWNER = value("owner");
const LIMIT = Number(value("limit") ?? 0) || Infinity;
const CONCURRENCY = Math.max(1, Number(value("concurrency") ?? 8) || 8);
const FRESH_MINUTES = Number(value("fresh-minutes") ?? 30);
const KEEP_SOURCE = flag("keep-source");
const SCAN_LEFTOVERS = flag("scan-leftovers");
const REPORT = value("report");

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
      "SUPABASE_SERVICE_ROLE_KEY) are required - the rows have to move with " +
      "the objects.",
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

// --- the key layout, copied from src/lib/media/keys.ts

const kindFolder = (kind) => (kind === "video" ? "videos" : "photos");

const fullKey = (row, ext) =>
  `${row.owner_id}/${row.event_id}/${kindFolder(row.kind)}/full/${row.id}.${ext}`;

// Photos only, which is why the folder is not `kindFolder(row.kind)`.
const thumbKey = (row, ext) =>
  `${row.owner_id}/${row.event_id}/photos/thumb/${row.id}.${ext}`;

const posterKey = (row, ext) =>
  `${row.owner_id}/${row.event_id}/videos/poster/${row.id}.${ext}`;

const archiveKey = (event) =>
  `${event.owner_id}/${event.id}/archive/${event.id}.zip`;

/**
 * The extension comes off the existing key rather than from `media_format`: the key is
 * where the object actually is.
 */
const EXT_FROM_FORMAT = {
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  gif: "gif",
  webp: "webp",
  avif: "avif",
  heic: "heic",
  heif: "heic",
  mp4: "mp4",
  webm: "webm",
  mov: "mov",
};

const EXT_FROM_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heic",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function extOfKey(key) {
  const base = key.slice(key.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : null;
}

const normaliseMime = (mime) =>
  String(mime ?? "").toLowerCase().split(";")[0].trim();

async function extForObject(key, format, mime, fallback) {
  const fromKey = extOfKey(key);
  if (fromKey) return fromKey;

  const probed = await head(key);
  return (
    (probed?.contentType ? EXT_FROM_MIME[normaliseMime(probed.contentType)] : null) ??
    EXT_FROM_FORMAT[String(format ?? "").toLowerCase()] ??
    EXT_FROM_MIME[normaliseMime(mime)] ??
    fallback
  );
}

// Classes whose objects have to be restored before anything can read them.
const FROZEN = new Set(["GLACIER", "DEEP_ARCHIVE"]);

// CopyObject caps at 5 GB. Nothing we store comes close; assert it anyway.
const COPY_MAX_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Tags, the one part of this that is not mechanical: a copy has to carry the
 * source's tags forward, which needs GetObjectTagging on the source.
 */
let tagMode = "unknown";

const eventTiers = new Map();

async function eventTier(eventId) {
  if (!eventTiers.has(eventId)) {
    const { data, error } = await db
      .from("events")
      .select("tier")
      .eq("id", eventId)
      .maybeSingle();
    if (error) throw new Error(`Reading event ${eventId} failed: ${error.message}`);
    eventTiers.set(eventId, data?.tier ?? null);
  }
  return eventTiers.get(eventId);
}

/** One GetObjectTagging against a real object, to decide which mode to run in. */
async function probeTagPermission(key) {
  try {
    await s3.send(new GetObjectTaggingCommand({ Bucket: bucket, Key: key }));
    tagMode = "copy";
    console.log("Tags: readable, so they are copied verbatim.\n");
  } catch (error) {
    if (!isAccessDenied(error)) throw error;
    tagMode = "rebuild";
    console.log(
      "Tags: s3:GetObjectTagging is denied for these credentials, so the\n" +
        "      `tier` tag is rebuilt from events.tier instead of copied. No\n" +
        "      lifecycle rule filters on `tier`, so no object changes storage\n" +
        "      class, retention or price - but an object uploaded before its\n" +
        "      host changed plan comes out tagged with the current plan.\n" +
        "      Add s3:GetObjectTagging to the credentials for exact copies.\n",
    );
  }
}

const isAccessDenied = (error) =>
  error?.name === "AccessDenied" ||
  error?.name === "AccessDeniedException" ||
  error?.$metadata?.httpStatusCode === 403;

/** The TagSet to write on the destination, or null to leave it untagged. */
async function tagsFor(sourceKey, row) {
  if (tagMode === "copy") {
    const res = await s3.send(
      new GetObjectTaggingCommand({ Bucket: bucket, Key: sourceKey }),
    );
    return res.TagSet ?? [];
  }

  const tier = await eventTier(row.event_id);
  return tier ? [{ Key: "tier", Value: tier }] : [];
}

async function head(key) {
  try {
    const res = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      size: res.ContentLength ?? 0,
      contentType: res.ContentType ?? null,
      // HeadObject omits StorageClass for Standard, which is also CopyObject's default.
      storageClass: res.StorageClass ?? "STANDARD",
      restored: typeof res.Restore === "string" && /ongoing-request="false"/.test(res.Restore),
    };
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") {
      return null;
    }
    throw error;
  }
}

// CopySource is a path, so every segment is encoded - old keys had spaces.
const copySource = (key) =>
  [bucket, ...key.split("/")].map(encodeURIComponent).join("/");

async function copyObject(from, to, row) {
  const source = await head(from);
  if (!source) {
    // The destination existing without the source is the normal shape of a resumed run:
    // the copy and the delete both happened, the row update did not.
    const landed = await head(to);
    return landed ? { state: "already", bytes: landed.size } : { state: "missing" };
  }

  const landed = await head(to);
  if (landed && landed.size === source.size) {
    return { state: "already", bytes: landed.size };
  }

  if (FROZEN.has(source.storageClass) && !source.restored) {
    return { state: "frozen", bytes: source.size, storageClass: source.storageClass };
  }
  if (source.size > COPY_MAX_BYTES) {
    return { state: "too-big", bytes: source.size };
  }

  if (!CONFIRM) return { state: "copied", bytes: source.size, dryRun: true };

  const tags = await tagsFor(from, row);

  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: to,
      CopySource: copySource(from),
      // Metadata defaults to COPY, so Content-Type rides along. Storage class is the
      // one thing CopyObject does not inherit: omit it and a Glacier IR object lands in
      // Standard at six times the price.
      StorageClass:
        source.storageClass === "STANDARD" ? undefined : source.storageClass,
      // Always REPLACE, never COPY - see the note on tagMode above.
      TaggingDirective: "REPLACE",
      Tagging: new URLSearchParams(tags.map((t) => [t.Key, t.Value])).toString(),
    }),
  );

  // Trust nothing about a copy before the row is repointed at it.
  const written = await head(to);
  if (!written || written.size !== source.size) {
    throw new Error(
      `Copy of ${from} to ${to} did not land (${written?.size ?? "absent"} vs ${source.size} bytes).`,
    );
  }

  return { state: "copied", bytes: source.size };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

function record(entry) {
  if (!REPORT) return;
  appendFileSync(REPORT, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

const stats = {
  rowsScanned: 0,
  rowsCurrent: 0,
  rowsMoved: 0,
  rowsSkippedFresh: 0,
  objectsCopied: 0,
  objectsAlready: 0,
  objectsMissing: 0,
  objectsFrozen: 0,
  objectsDeleted: 0,
  bytesCopied: 0,
  failures: 0,
};

const touchedEvents = new Map();
const problems = [];

/**
 * Keyset pagination on the primary key: an offset would re-read rows as the updates
 * shift them.
 */
async function* mediaRows() {
  let cursor = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    let query = db
      .from("media")
      .select(
        "id, event_id, owner_id, kind, status, processing, created_at, media_key, thumb_key, poster_key, media_format, thumb_format, mime_type",
      )
      .neq("status", "deleted")
      .gt("id", cursor)
      .order("id", { ascending: true })
      .limit(500);

    if (ONE_EVENT) query = query.eq("event_id", ONE_EVENT);
    if (ONE_OWNER) query = query.eq("owner_id", ONE_OWNER);

    const { data, error } = await query;
    if (error) throw new Error(`Reading media failed: ${error.message}`);
    if (!data || data.length === 0) return;

    yield* data;
    cursor = data[data.length - 1].id;
  }
}

/** Where each of a row's objects belongs, for the objects it actually has. */
async function plan(row) {
  const moves = [];

  const mediaExt = await extForObject(
    row.media_key,
    row.media_format,
    row.mime_type,
    "bin",
  );
  const wantMedia = fullKey(row, mediaExt);
  if (row.media_key !== wantMedia) {
    moves.push({ column: "media_key", from: row.media_key, to: wantMedia });
  }

  if (row.thumb_key) {
    const ext = await extForObject(
      row.thumb_key,
      row.thumb_format,
      "image/webp",
      "webp",
    );
    const want = thumbKey(row, ext);
    if (row.thumb_key !== want) {
      moves.push({ column: "thumb_key", from: row.thumb_key, to: want });
    }
  }

  if (row.poster_key) {
    const ext = await extForObject(row.poster_key, null, "image/jpeg", "jpg");
    const want = posterKey(row, ext);
    if (row.poster_key !== want) {
      moves.push({ column: "poster_key", from: row.poster_key, to: want });
    }
  }

  return moves;
}

async function migrateRow(row) {
  const moves = await plan(row);
  if (moves.length === 0) {
    stats.rowsCurrent++;
    return;
  }

  /**
   * A just-uploaded clip is left where it is: the transcode queue has already handed a
   * worker a presigned URL for its current key.
   */
  const ageMinutes = (Date.now() - new Date(row.created_at).getTime()) / 60000;
  if (row.processing === "pending" && ageMinutes < FRESH_MINUTES) {
    stats.rowsSkippedFresh++;
    return;
  }

  const patch = {};
  const done = [];

  for (const move of moves) {
    const result = await copyObject(move.from, move.to, row);

    if (result.state === "copied") {
      stats.objectsCopied++;
      stats.bytesCopied += result.bytes ?? 0;
      patch[move.column] = move.to;
      done.push(move);
    } else if (result.state === "already") {
      stats.objectsAlready++;
      patch[move.column] = move.to;
      done.push(move);
    } else {
      // Missing, frozen or oversized: the column keeps pointing at the object that is
      // actually there. Re-running after a restore finishes the job.
      if (result.state === "frozen") stats.objectsFrozen++;
      else stats.objectsMissing++;
      problems.push({
        media: row.id,
        event: row.event_id,
        column: move.column,
        key: move.from,
        reason: result.state,
        storageClass: result.storageClass,
      });
    }
  }

  if (Object.keys(patch).length === 0) return;

  if (CONFIRM) {
    const { error } = await db.from("media").update(patch).eq("id", row.id);
    if (error) {
      // The copies are already in the bucket. Leaving the sources alone is what keeps
      // this recoverable - a re-run sees the destinations as already done.
      throw new Error(`Updating media ${row.id} failed: ${error.message}`);
    }
  }

  // Only now, with the row pointing at the new keys, is the old object dead.
  if (CONFIRM && !KEEP_SOURCE) {
    const stale = done.filter((m) => m.from !== m.to).map((m) => m.from);
    if (stale.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: stale.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      stats.objectsDeleted += stale.length;
    }
  }

  stats.rowsMoved++;
  touchedEvents.set(row.event_id, row.owner_id);
  record({ action: "moved", media: row.id, event: row.event_id, moves: done });

  if (stats.rowsMoved % 100 === 0) {
    console.log(`  ${stats.rowsMoved} rows moved, ${stats.rowsScanned} scanned...`);
  }
}

/**
 * A ZIP is derived data, expires on a lifecycle tag and is rebuilt on demand, so a
 * stale one is reported rather than moved.
 */
async function checkArchives() {
  let cursor = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    let query = db
      .from("events")
      .select("id, owner_id, archive_key")
      .not("archive_key", "is", null)
      .gt("id", cursor)
      .order("id", { ascending: true })
      .limit(500);

    if (ONE_EVENT) query = query.eq("id", ONE_EVENT);
    if (ONE_OWNER) query = query.eq("owner_id", ONE_OWNER);

    const { data, error } = await query;
    if (error) throw new Error(`Reading events failed: ${error.message}`);
    if (!data || data.length === 0) return;

    for (const event of data) {
      if (event.archive_key !== archiveKey(event)) {
        problems.push({
          event: event.id,
          column: "archive_key",
          key: event.archive_key,
          reason: "stale-archive",
        });
      }
    }

    cursor = data[data.length - 1].id;
  }
}

/** Reservations are reported and never moved: a reservation is an upload in flight. */
async function checkReservations() {
  let query = db
    .from("upload_reservations")
    .select("id, event_id, media_key, created_at");
  if (ONE_EVENT) query = query.eq("event_id", ONE_EVENT);
  if (ONE_OWNER) query = query.eq("owner_id", ONE_OWNER);

  const { data, error } = await query;
  if (error) throw new Error(`Reading reservations failed: ${error.message}`);

  for (const row of data ?? []) {
    if (!/\/(photos|videos)\/(full|thumb|poster)\//.test(row.media_key)) {
      problems.push({
        event: row.event_id,
        column: "reservation",
        key: row.media_key,
        reason: "stale-reservation",
      });
    }
  }
}

/** A leftover is defined by the database, not by the shape of the key. */
async function scanLeftovers() {
  console.log(`\nScanning ${touchedEvents.size} event prefix(es) for leftovers.`);
  let total = 0;

  for (const [eventId, ownerId] of touchedEvents) {
    const referenced = new Set();

    const { data: rows, error } = await db
      .from("media")
      .select("media_key, thumb_key, poster_key")
      .eq("event_id", eventId)
      .neq("status", "deleted");
    if (error) throw new Error(`Reading media failed: ${error.message}`);
    for (const row of rows ?? []) {
      for (const key of [row.media_key, row.thumb_key, row.poster_key]) {
        if (key) referenced.add(key);
      }
    }

    const { data: event } = await db
      .from("events")
      .select("archive_key")
      .eq("id", eventId)
      .maybeSingle();
    if (event?.archive_key) referenced.add(event.archive_key);

    let token;
    const strays = [];
    do {
      const listed = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `${ownerId}/${eventId}/`,
          ContinuationToken: token,
        }),
      );
      for (const object of listed.Contents ?? []) {
        if (object.Key && !referenced.has(object.Key)) strays.push(object.Key);
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);

    total += strays.length;
    if (strays.length > 0) {
      console.log(`  ${eventId}: ${strays.length} object(s) nothing points at`);
      for (const key of strays.slice(0, 5)) console.log(`    ${key}`);
      if (strays.length > 5) console.log(`    ... and ${strays.length - 5} more`);
      record({ action: "leftovers", event: eventId, keys: strays });
    }
  }

  console.log(
    total === 0
      ? "  Nothing unreferenced."
      : "\nNothing here deletes these - read the list, then use " +
          "scripts/purge-legacy-prefix.mjs with a --prefix.",
  );
}

console.log(
  CONFIRM
    ? `Reorganising s3://${bucket} into the current key layout.`
    : `Dry run against s3://${bucket}. Nothing is copied, updated or deleted - pass --confirm.`,
);
if (ONE_EVENT) console.log(`Event ${ONE_EVENT} only.`);
if (ONE_OWNER) console.log(`Owner ${ONE_OWNER} only.`);
console.log("");

/**
 * Settled before the walk rather than on the first copy, so a dry run reports it too.
 */
{
  let probe = db
    .from("media")
    .select("media_key")
    .neq("status", "deleted")
    .limit(1);
  if (ONE_EVENT) probe = probe.eq("event_id", ONE_EVENT);
  if (ONE_OWNER) probe = probe.eq("owner_id", ONE_OWNER);
  const { data, error } = await probe;
  if (error) throw new Error(`Reading media failed: ${error.message}`);
  if (data?.[0]) await probeTagPermission(data[0].media_key);
}

const pending = [];

for await (const row of mediaRows()) {
  stats.rowsScanned++;
  pending.push(row);

  if (pending.length >= CONCURRENCY * 4) {
    await drain();
    if (stats.rowsMoved >= LIMIT) break;
  }
}
await drain();

async function drain() {
  const batch = pending.splice(0, pending.length);
  const results = await mapLimit(batch, CONCURRENCY, async (row) => {
    try {
      await migrateRow(row);
    } catch (error) {
      stats.failures++;
      console.error(`  x media ${row.id}: ${error.message}`);
      record({ action: "failed", media: row.id, error: String(error.message) });
    }
  });
  return results;
}

await checkArchives();
await checkReservations();
if (SCAN_LEFTOVERS && touchedEvents.size > 0) await scanLeftovers();

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

console.log(`\n${CONFIRM ? "Done" : "Dry run complete"}.`);
console.log(`  rows scanned            ${stats.rowsScanned}`);
console.log(`  already current         ${stats.rowsCurrent}`);
console.log(`  rows ${CONFIRM ? "moved           " : "that would move "}   ${stats.rowsMoved}`);
console.log(`  events affected         ${touchedEvents.size}`);
console.log(`  objects copied          ${stats.objectsCopied} (${mb(stats.bytesCopied)})`);
console.log(`  already at destination  ${stats.objectsAlready}`);
console.log(`  old objects deleted     ${stats.objectsDeleted}`);

if (stats.rowsSkippedFresh > 0) {
  console.log(
    `  uploaded just now       ${stats.rowsSkippedFresh} (transcode may be mid-job; re-run later, or --fresh-minutes=0)`,
  );
}
if (stats.objectsMissing > 0) {
  console.log(`  no object in bucket     ${stats.objectsMissing}`);
}
if (stats.objectsFrozen > 0) {
  console.log(
    `  frozen in Glacier       ${stats.objectsFrozen} (restore, then re-run)`,
  );
}
if (stats.failures > 0) console.log(`  failed                  ${stats.failures}`);

if (problems.length > 0) {
  console.log(`\n${problems.length} thing(s) left alone:`);
  for (const p of problems.slice(0, 20)) {
    console.log(`  ${p.reason.padEnd(18)} ${p.column} ${p.key}`);
  }
  if (problems.length > 20) console.log(`  ... and ${problems.length - 20} more`);
  record({ action: "problems", problems });
}

if (!CONFIRM && stats.rowsMoved > 0) {
  console.log(
    `\nRun it for one event first:\n  node --env-file=.env scripts/reorganize-storage-layout.mjs --confirm --event=${[...touchedEvents.keys()][0] ?? "<uuid>"}`,
  );
}

process.exit(stats.failures > 0 ? 1 : 0);
