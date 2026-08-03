# ffmpeg with libheif, which is what decodes the HEIC files iPhones produce.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY index.mjs ./

# No dependencies on purpose. Everything it needs is in Node's standard library
# plus the ffmpeg binary, so there is no npm supply chain attached to the one
# process in this system that parses files uploaded by strangers.
USER node

ENV POLL_SECONDS=20 BATCH=3
CMD ["node", "index.mjs"]
