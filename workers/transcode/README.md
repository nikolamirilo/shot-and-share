# Transcode worker

Finishes the two jobs a browser cannot do. **It is not deployed** — the code is
here and runs anywhere with ffmpeg, but it needs a host.

## What it does

| Input | Output | Why |
|---|---|---|
| HEIC photo the browser could not decode | JPEG display + thumbnail | An iPhone photo uploaded from desktop Chrome is otherwise a file most guests and half the hosts cannot open |
| Any video | H.264 / AAC MP4, faststart, max 1080p | The one combination that plays everywhere, and usually about half the size of what a phone produces |

Everything else — the overwhelming majority of uploads — is already handled in
the browser before it leaves the phone and never reaches this queue.

## Running it

```bash
docker build -t saycheese-transcode .

docker run --rm \
  -e APP_URL=https://saycheese.app \
  -e WORKER_SECRET=... \
  saycheese-transcode
```

Locally, with ffmpeg already installed:

```bash
APP_URL=http://localhost:3000 WORKER_SECRET=dev node index.mjs
```

Set the same `WORKER_SECRET` on the app. Without it, `/api/internal/transcode`
rejects everything.

## It holds no AWS credentials

The worker asks the app for jobs and receives presigned URLs — one to read the
input, one for each output it is allowed to write. It cannot choose where in the
bucket it writes, cannot list the bucket, and cannot touch another event.

This is deliberate. A process running ffmpeg over files uploaded by strangers is
the most likely thing in this system to be compromised, and ffmpeg parsing a
hostile file has a long history of doing so. It is given nothing worth stealing.

## Where to run it

| Option | Notes |
|---|---|
| **Fargate**, one small always-on task | Simplest. A single 0.5 vCPU task keeps up with far more than launch volume, and there is no 15-minute ceiling to design around |
| **Lambda** with an ffmpeg layer | Cheaper when idle, but a long wedding video will hit the 15-minute limit and the ephemeral disk cap |
| **A spare box** | Fine. It is a polling loop with no inbound ports |

Polling rather than an S3 event or a queue is a deliberate simplification: the
work is rare, latency of a few seconds does not matter to anybody, and it means
one moving part instead of three. If volume grows to where polling is wasteful,
the claim endpoint is the right place to put SQS behind.

## Failure is not data loss

If ffmpeg cannot read a file, the row is marked `failed` and the original is
left completely untouched — still stored, still in the ZIP, still downloadable.
The guest sees the photo they uploaded. Nothing is ever deleted because a
conversion did not work.

If the event has filled its quota between upload and conversion, the app throws
away what the worker wrote rather than pushing the host over their limit.

## Tuning

| Variable | Default | |
|---|---|---|
| `POLL_SECONDS` | 20 | How often to ask for work |
| `BATCH` | 3 | Jobs claimed per poll |
| `FFMPEG_PATH` / `FFPROBE_PATH` | `ffmpeg` / `ffprobe` | For layer-based deployments |

`VIDEO_CRF` is 23 in the source. Raising it to 26 roughly halves the output
again and starts to show on a projector — which is exactly where wedding videos
get played, so it was left alone.
