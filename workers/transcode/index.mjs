#!/usr/bin/env node
/**
 * Say Cheese transcode worker.
 *
 * Finishes the two jobs a browser cannot do:
 *
 *   - Images the browser could not decode. In practice this is HEIC outside
 *     Safari. It becomes a JPEG so that every device on earth can open it.
 *   - Video. Anything a guest uploads becomes H.264 in an MP4 with AAC audio
 *     and the moov atom at the front, which is the one combination that plays
 *     on every phone, browser, laptop and smart TV without a codec argument.
 *     It also usually halves the size of a phone clip, because phones encode
 *     for speed rather than for size.
 *
 * It holds no AWS credentials. It asks the app for work, gets presigned URLs
 * to read the input and write the outputs, and reports back. A process running
 * ffmpeg over files uploaded by strangers is the most likely thing in this
 * system to be compromised, so it is given nothing worth stealing.
 *
 * Run it anywhere with ffmpeg: a container on Fargate, a Lambda with an ffmpeg
 * layer, or a spare box. See README.md in this directory.
 */

import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const APP_URL = required("APP_URL");
const WORKER_SECRET = required("WORKER_SECRET");
const POLL_SECONDS = Number(process.env.POLL_SECONDS ?? 20);
const BATCH = Number(process.env.BATCH ?? 3);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

/**
 * Constant Rate Factor. 23 is ffmpeg's default and visually transparent for
 * this material; 26 would halve the size again and start showing on a
 * projector, which is exactly where these get played.
 */
const VIDEO_CRF = 23;

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}`);
    process.exit(1);
  }
  return value;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${command} exited ${code}: ${stderr.slice(-2000)}`)),
    );
  });
}

async function download(url, destination) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destination));
}

/** Posts to the presigned policy exactly the way a browser would. */
async function upload(target, filePath, contentType) {
  const form = new FormData();
  for (const [key, value] of Object.entries(target.upload.fields)) {
    form.append(key, value);
  }
  const { size } = await stat(filePath);
  const buffer = await new Response(createReadStream(filePath)).arrayBuffer();
  form.append(target.upload.fileField, new Blob([buffer], { type: contentType }));

  const res = await fetch(target.upload.url, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  }
  return size;
}

async function probe(filePath) {
  const raw = await run(FFPROBE, [
    "-v", "error",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    filePath,
  ]);
  const parsed = JSON.parse(raw);
  const video = (parsed.streams ?? []).find((s) => s.codec_type === "video");
  return {
    width: video?.width ?? null,
    height: video?.height ?? null,
    durationSeconds: parsed.format?.duration
      ? Number(parsed.format.duration)
      : null,
  };
}

async function handleVideo(job, dir) {
  const input = path.join(dir, "input");
  await download(job.input, input);

  const info = await probe(input);
  const outputPath = path.join(dir, "out.mp4");

  await run(FFMPEG, [
    "-y",
    "-i", input,
    // The clip keeps the dimensions it was filmed at. It used to be capped at
    // 1080p, which is fine on a phone and visibly soft on the projector these
    // get played through - and the guest cannot re-upload the good copy later,
    // because by then the original is gone. The only change made here is
    // rounding to an even width and height, which H.264 requires.
    "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:v", "libx264",
    // Baseline-ish profile: old Android and smart TVs refuse High 10.
    "-profile:v", "high",
    // No fixed -level. It was pinned to 4.0, which tops out just above 1080p:
    // now that a 4K clip stays 4K, the level has to follow the footage, and
    // x264 works out the right one from the dimensions and frame rate.
    "-pix_fmt", "yuv420p",
    "-preset", "medium",
    "-crf", String(VIDEO_CRF),
    "-c:a", "aac",
    "-b:a", "128k",
    "-ac", "2",
    // Put the index at the front so the video starts playing before it has
    // finished downloading. Without this a guest stares at a black rectangle.
    "-movflags", "+faststart",
    // Drop everything the phone wrote into the container: the GPS location of
    // the party, the device, the creation time. A guest filming inside
    // somebody's house is handing over that address otherwise, and the privacy
    // policy promises this happens.
    //
    // Photos need no equivalent: they are re-encoded through a canvas in the
    // browser before they are uploaded, which drops the EXIF block on the way.
    "-map_metadata", "-1",
    outputPath,
  ]);

  // This replaces the clip in the bucket rather than sitting beside it: the
  // app drops the object the guest uploaded once the row points here.
  //
  // No thumbnail: a clip's poster frame is already its small copy.
  const outputs = { mediaBytes: 0, thumbBytes: 0, posterBytes: 0 };
  outputs.mediaBytes = await upload(
    job.outputs.media,
    outputPath,
    job.outputs.media.contentType,
  );

  if (job.outputs.poster) {
    const posterPath = path.join(dir, "poster.jpg");
    const seek = info.durationSeconds ? Math.min(1, info.durationSeconds / 10) : 0;
    await run(FFMPEG, [
      "-y",
      "-ss", String(seek),
      "-i", input,
      "-frames:v", "1",
      "-vf", "scale='min(720,iw)':-2",
      "-q:v", "4",
      posterPath,
    ]);
    outputs.posterBytes = await upload(
      job.outputs.poster,
      posterPath,
      job.outputs.poster.contentType,
    );
  }

  return { ...outputs, ...info };
}

async function handleImage(job, dir) {
  const input = path.join(dir, "input");
  await download(job.input, input);

  const info = await probe(input);
  const outputs = { mediaBytes: 0, thumbBytes: 0, posterBytes: 0 };

  // ffmpeg decodes HEIC where it was built with libheif, which is the case for
  // every current build. One codec toolchain instead of two.
  //
  // No scale filter: the photo keeps every pixel it was taken with. It used to
  // be capped at 2560, which is fine on a phone and throws away about 60% of a
  // 12MP photo for anyone who wants to print it or crop into it - and the
  // guest cannot re-upload the good copy later, because by then it is gone.
  const fullPath = path.join(dir, "full.jpg");
  // -map_metadata -1 for the same reason it is on the video: this is the one
  // photo path that does not go through the browser's canvas, so it is the one
  // place an EXIF GPS tag could still reach the bucket.
  await run(FFMPEG, [
    "-y",
    "-i", input,
    "-q:v", "3",
    "-map_metadata", "-1",
    fullPath,
  ]);

  // The JPEG replaces the file the guest uploaded; the app deletes the HEIC
  // once the row moves.
  outputs.mediaBytes = await upload(
    job.outputs.media,
    fullPath,
    job.outputs.media.contentType,
  );

  // The small copy for the grid. Written second on purpose: if this fails the
  // photo is already stored and viewable, and the grid falls back to the full
  // copy through the optimiser.
  if (job.outputs.thumb) {
    try {
      const thumbPath = path.join(dir, "thumb.webp");
      await run(FFMPEG, [
        "-y",
        "-i", input,
        "-vf", "scale='min(640,iw)':-2:flags=lanczos",
        "-c:v", "libwebp",
        "-quality", "78",
        thumbPath,
      ]);
      outputs.thumbBytes = await upload(
        job.outputs.thumb,
        thumbPath,
        job.outputs.thumb.contentType,
      );
    } catch (error) {
      console.error(
        `[worker] thumbnail failed for ${job.mediaId}:`,
        error.message,
      );
    }
  }

  return { ...outputs, ...info };
}

async function report(payload) {
  const res = await fetch(`${APP_URL}/api/internal/transcode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WORKER_SECRET}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error("[worker] report rejected", res.status, await res.text());
  }
}

async function processJob(job) {
  const dir = await mkdtemp(path.join(tmpdir(), "saycheese-"));
  try {
    const result =
      job.kind === "video"
        ? await handleVideo(job, dir)
        : await handleImage(job, dir);

    await report({ mediaId: job.mediaId, ok: true, ...result });
    console.log(`[worker] done ${job.mediaId} (${job.kind})`);
  } catch (error) {
    // The original is untouched and still downloadable. This marks the row so
    // it is not retried forever and an operator can find it.
    console.error(`[worker] failed ${job.mediaId}:`, error.message);
    await report({
      mediaId: job.mediaId,
      ok: false,
      error: String(error.message).slice(0, 500),
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function claim() {
  const res = await fetch(
    `${APP_URL}/api/internal/transcode?limit=${BATCH}`,
    { headers: { Authorization: `Bearer ${WORKER_SECRET}` } },
  );
  if (!res.ok) {
    console.error("[worker] claim failed", res.status);
    return [];
  }
  const body = await res.json();
  return body.jobs ?? [];
}

async function main() {
  console.log(`[worker] polling ${APP_URL} every ${POLL_SECONDS}s`);
  // Fail fast and loudly if the image is missing its whole reason for existing.
  await run(FFMPEG, ["-version"]);

  for (;;) {
    try {
      const jobs = await claim();
      if (jobs.length === 0) {
        await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
        continue;
      }
      // Sequential on purpose: ffmpeg already saturates the cores it is given,
      // and running three at once just makes all three slower.
      for (const job of jobs) await processJob(job);
    } catch (error) {
      console.error("[worker] loop error", error);
      await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
    }
  }
}

main();
