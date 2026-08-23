#!/usr/bin/env bash
# Re-records every README clip and shot against a running demo in editing
# mode and copies the results into .github/assets/.
#
#   cd demo && WIKI=1 npx astro dev --port 4321 --host 127.0.0.1   # in another shell
#   scripts/readme-clips/record-all.sh
#
# Needs Chrome (CHROME_PATH, default /usr/bin/google-chrome), ffmpeg, and —
# for tour-ai — the `claude` CLI on PATH. Each clip edits the demo's content
# files; the script restores them with git after every clip.
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$PWD
WORK=$(mktemp -d)
export BASE="${BASE:-http://127.0.0.1:4321}"
trap 'git -C "$ROOT" checkout -- demo/src/content' EXIT

for clip in hero tour-ai tour-wikilink tour-frontmatter; do
  echo "== $clip"
  node scripts/readme-clips/$clip.mjs "$WORK/$clip.mp4"
  git checkout -- demo/src/content
done
node scripts/readme-clips/shot-guard.mjs "$WORK/guard.png"
git checkout -- demo/src/content
node scripts/readme-clips/shot-history.mjs "$WORK/history.png"

cp "$WORK/hero.gif" .github/assets/hero-edit.gif
cp "$WORK/tour-ai.gif" "$WORK/tour-wikilink.gif" "$WORK/tour-frontmatter.gif" .github/assets/
cp "$WORK/guard.png" "$WORK/history.png" .github/assets/
ls -la .github/assets
