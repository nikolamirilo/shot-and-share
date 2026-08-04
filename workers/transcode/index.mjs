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

/** Long edge of the transcoded video. 1080p is plenty for a phone clip. */
const VIDEO_MAX_EDGE = 1920;
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
    // Never upscale, and keep dimensions even - H.264 requires it.
    "-vf", `scale='min(${VIDEO_MAX_EDGE},iw)':-2:flags=lanczos`,
    "-c:v", "libx264",
    // Baseline-ish profile: old Android and smart TVs refuse High 10.
    "-profile:v", "high",
    "-level", "4.0",
    "-pix_fmt", "yuv420p",
    "-preset", "medium",
    "-crf", String(VIDEO_CRF),
    "-c:a", "aac",
    "-b:a", "128k",
    "-ac", "2",
    // Put the index at the front so the video starts playing before it has
    // finished downloading. Without this a guest stares at a black rectangle.
    "-movflags", "+faststart",
    outputPath,
  ]);

  const outputs = { displayBytes: 0, posterBytes: 0, thumbBytes: 0 };
  outputs.displayBytes = await upload(
    job.outputs.display,
    outputPath,
    job.outputs.display.contentType,
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
  const displayPath = path.join(dir, "display.jpg");

  // ffmpeg decodes HEIC where it was built with libheif, which is the case for
  // every current build. One codec toolchain instead of two.
  await run(FFMPEG, [
    "-y",
    "-i", input,
    "-vf", "scale='min(2560,iw)':-2:flags=lanczos",
    "-q:v", "3",
    displayPath,
  ]);

  const outputs = { displayBytes: 0, thumbBytes: 0, posterBytes: 0 };
  outputs.displayBytes = await upload(
    job.outputs.display,
    displayPath,
    job.outputs.display.contentType,
  );

  if (job.outputs.thumb) {
    const thumbPath = path.join(dir, "thumb.jpg");
    await run(FFMPEG, [
      "-y",
      "-i", input,
      "-vf", "scale='min(720,iw)':-2:flags=lanczos",
      "-q:v", "5",
      thumbPath,
    ]);
    outputs.thumbBytes = await upload(
      job.outputs.thumb,
      thumbPath,
      job.outputs.thumb.contentType,
    );
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
