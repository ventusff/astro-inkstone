# Deploy skeleton: static site + editing machine

One content tree, two services (reading and editing split apart) — a
production shape this stack is designed around:

```
static/   The reader entry: astro build → nginx. Rebuilt on every push;
          the container is stateless, redeploying updates it.
wiki/     The editing entry: a permanent WIKI=1 astro dev + astro-inkbrush.
          The repo checkout lives in a named volume; the entrypoint handles
          clone-or-pull (a diverged volume is replayed with rebase),
          submodule sync, decoding INKBRUSH_CONFIG_B64 into the config file,
          npm install, and clearing stale PID locks.
```

Deployment notes baked into the skeleton:

- **Give the editing machine its own subdomain — never a path prefix under
  the reader host.** The dev server's virtual-module URLs are root-relative
  and ignore any base, so a path prefix sends them to whatever else owns
  that root, and the editor 500s.
- nginx must also `listen [::]:80`, and the health probe uses `127.0.0.1` —
  alpine's wget resolves `localhost` to `::1`, so a v4-only listener looks
  dead to the reverse proxy and gets pulled from rotation.
- Config arrives as base64 service env (decoded by the entrypoint) and a
  missing value is a **hard failure** — the defaults keep autocommit and
  autopush off, so degrading silently means edits quietly never reach git.
  Prefer plain service environment over any panel-managed file-mount
  feature for these values.
- The dev server's PID lock (`.astro/dev.json`) survives container restarts
  inside the volume. Delete it at startup; do **not** use `--force`, which
  kills the PID recorded in the lock — in a fresh container that PID is
  usually some other process, possibly your own.
- Two webhooks, filtered by committer: the static site rebuilds on every
  push; the editing machine restarts only on pushes from outside (the CMS's
  own autopush commits must not bounce the editor — that would loop).

`compose.example.yml` is a skeleton, not a finished config: fill in domains,
repository URLs and volume names for your site. Envs marked `:?` fail at
`compose up` when missing.
