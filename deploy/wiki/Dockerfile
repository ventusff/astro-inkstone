# The editing machine. node + git only — the app and its content both live
# in a named-volume checkout, so the image is just a runtime shell.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY deploy/wiki/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# Starts as root so it can take ownership of a freshly created named volume
# (docker creates it root-owned), then re-execs itself as `node`. Running the
# dev server as root would leave every file in the volume root-owned, which
# the next `npm install` from a non-root context cannot fix.
ENTRYPOINT ["/entrypoint.sh"]
