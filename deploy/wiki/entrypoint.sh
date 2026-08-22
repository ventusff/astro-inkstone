#!/bin/sh
# Container entry: clone-or-pull the repo into the volume → pull the vendored
# CMS submodule → inject the machine's inkbrush config → run the permanent
# WIKI dev server.
#
# Volume contract: ff-only first, and a diverged volume is replayed with
# rebase — local commits in there can only ever be inkbrush autocommits of
# doc edits, which are always safe to replay on top of the remote.
set -eu

D=/repo/site
#: Note content, relative to the repo root — the same tree the injected
#: config's `content.dir` points at. Only this is rescued on a dirty start.
CONTENT_DIR=src/content

# A named volume is created root-owned, and this container runs its server as
# `node`. Take ownership once, as root, then hand the rest of the script to
# node — running the dev server as root would leave the whole volume
# root-owned and a later non-root npm install could not repair it.
if [ "$(id -u)" = "0" ]; then
    mkdir -p /repo
    chown node:node /repo
    exec su node -s /bin/sh -c "exec $0"
fi
git config --global --add safe.directory "$D"
git config --global --add safe.directory "$D/vendor/astro-inkbrush"

# Bot account SSH key: repo pull/autopush and the cross-owner fetch of the
# inkbrush submodule. Decoded out of the environment (see the compose file for
# why not a File Mount) at 0600 — ssh refuses a key file any wider than that.
if [ -n "${BOT_SSH_KEY_B64:-}" ]; then
    ( umask 077; printf '%s' "$BOT_SSH_KEY_B64" | base64 -d > /tmp/bot-key )
    export GIT_SSH_COMMAND="ssh -i /tmp/bot-key -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/tmp/known_hosts"
    echo "[entrypoint] bot key installed"
else
    echo "[entrypoint] FATAL: BOT_SSH_KEY_B64 unset — no git over SSH." >&2
    exit 1
fi

# The IdP's SAML signing certificate. Public by construction — it is what an SP
# uses to verify the IdP's signature, and no private key is involved — but it
# has to be a readable FILE on disk or inkbrush reports the provider as
# `unconfigured` and refuses to start the login. In a setup where the ACS
# lives on another deployment sharing the same IdP app (see the injected
# config), this machine never validates an assertion itself — the file then
# exists purely to satisfy that readiness check.
if [ -n "${SAML_IDP_CERT_B64:-}" ]; then
    printf '%s' "$SAML_IDP_CERT_B64" | base64 -d > /tmp/google-saml.pem
else
    echo "[entrypoint] FATAL: SAML_IDP_CERT_B64 unset — SSO login would be dead." >&2
    exit 1
fi

if [ ! -d "$D/.git" ]; then
    echo "[entrypoint] cloning into the volume ..."
    git clone --single-branch --branch main "${REPO_URL:?set REPO_URL}" "$D"
    git -C "$D" config user.name  "${GIT_COMMITTER_NAME:-wiki-editor}"
    git -C "$D" config user.email "${GIT_COMMITTER_EMAIL:-wiki@example.com}"
else
    # Identity first: the rescue commit below cannot be made without one, and
    # a failed rescue leaves the worktree dirty, which is what jams the pull.
    git -C "$D" config user.name  "${GIT_COMMITTER_NAME:-wiki-editor}"
    git -C "$D" config user.email "${GIT_COMMITTER_EMAIL:-wiki@example.com}"
    # npm's on-disk side effects (package-lock drift) jam BOTH ff-only and
    # rebase, the error gets swallowed, and the volume then freezes on an old
    # commit — so the worktree has to be clean before pulling.
    #
    # Restoring *everything* (`git checkout -- .`) is what the obvious version
    # of this does, and it is wrong: it also destroys uncommitted note edits.
    # "There are uncommitted note edits" is exactly what a container looks
    # like when autocommit is off or has failed — the one moment those words
    # most need keeping is the moment that line would wipe them. Restore only
    # the lockfile, and commit whatever is left in the content tree.
    git -C "$D" checkout -q -- ':(glob)**/package-lock.json' 2>/dev/null || true
    if [ -n "$(git -C "$D" status --porcelain -- "$CONTENT_DIR")" ]; then
        echo "[entrypoint] uncommitted edits under $CONTENT_DIR — rescuing them into a commit:" >&2
        git -C "$D" status --porcelain -- "$CONTENT_DIR" >&2
        git -C "$D" add -A -- "$CONTENT_DIR"
        git -C "$D" commit -q -m "wiki: rescue uncommitted note edits found at container start

autocommit should have committed each save; that these survived a restart
means it was not in effect. The words matter more than a tidy history." \
            -- "$CONTENT_DIR" || true
    fi
    echo "[entrypoint] pulling ..."
    if ! git -C "$D" pull --ff-only 2>/dev/null; then
        echo "[entrypoint] diverged — replaying local doc commits with rebase ..."
        git -C "$D" pull --rebase || {
            git -C "$D" rebase --abort 2>/dev/null || true
            echo "[entrypoint] WARN: rebase failed; keeping the volume as-is (needs a human)" >&2
        }
    fi
fi

# A volume checkout may predate a remote-URL change; normalise origin and
# re-resolve the submodule's relative URL against it, or the fetch 403-loops.
git -C "$D" remote set-url origin "$REPO_URL"
git -C "$D" submodule sync --quiet
echo "[entrypoint] submodule (astro-inkbrush) ..."
git -C "$D" submodule update --init vendor/astro-inkbrush

# The CMS config, same channel. The in-repo path is gitignored and holds the
# dev config; this decoded copy owns the real session settings plus autopush.
if [ -n "${INKBRUSH_CONFIG_B64:-}" ]; then
    # Written into the checkout, not linked in: vite resolves a link's imports
    # from its real location, and 'astro-inkbrush/config' resolves from
    # nowhere outside the checkout — the wiki server then refuses to load.
    printf '%s' "$INKBRUSH_CONFIG_B64" | base64 -d > "$D/inkbrush.config.ts"
    echo "[entrypoint] inkbrush config installed"
else
    # Not a warning: the defaults are autocommit=false and autopush=false, so
    # the editor would keep saving and nothing would ever reach git — and the
    # next restart would take those edits with it.
    echo "[entrypoint] FATAL: INKBRUSH_CONFIG_B64 unset. The defaults leave" >&2
    echo "            autocommit and autopush off — edits would never reach git." >&2
    exit 1
fi

cd "$D"
# astro dev's PID lock survives a container restart inside the volume, and the
# pid in it points at a different process in the new container — deleting the
# lock is right; `--force` would kill the wrong process.
rm -f .astro/dev.json
echo "[entrypoint] npm install ..."
npm install --no-audit --no-fund
echo "[entrypoint] starting WIKI dev (base=${SITE_BASE:-/}) ..."
exec npx astro dev --host 0.0.0.0 --port 4321
