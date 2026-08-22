#!/usr/bin/env python3
"""Build the CJK monospace font subset used for code blocks (fixed charset).

Box diagrams inside code blocks only align if a Hanzi is exactly two
character cells wide and Latin and Hanzi come from the same font. Maple Mono
CN satisfies both (Latin 600, Hanzi 1200, box drawing/arrows 600, in
1/1000 em units), but the full font is tens of MB — this script cuts a
self-hostable subset.

The recipe is FIXED so one artifact serves every site:
  1. the full printable ASCII range 0x20-0x7e;
  2. a whitelist of box drawing / arrows / geometry / common symbols /
     CJK punctuation (SYMBOL_WHITELIST below);
  3. the 3500 most common Hanzi from the Table of General Standard Chinese
     Characters, level 1 (checked-in file hanzi-3500.txt — no network needed);
  4. the union of every character appearing in *.md / *.mdx files under the
     directories listed in an optional local manifest (see CONTENT_DIRS) —
     guarantees existing content has no missing glyphs.

Font source: a locally installed Maple Mono CN Regular (the "Normal NL NF CN"
build — no ligatures, with CJK — works well); set MAPLE_TTF to point at a
specific file.

Usage:   <venv>/bin/python fonts/build_font_subset.py   # venv with fonttools + brotli
Output:  fonts/MapleMonoCN-subset.woff2 (committed to git)
"""
import glob
import os
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'MapleMonoCN-subset.woff2'
HANZI_FILE = HERE / 'hanzi-3500.txt'

# -- recipe item 4: content scan directories (local manifest, not tracked) --
# Every *.md / *.mdx under each listed directory is scanned recursively
# (node_modules skipped) and every character found joins the subset, so
# existing content never falls back to a system font.
# The manifest lives at fonts/content-dirs.local.txt (gitignored; one
# absolute path per line, `#` starts a comment) — content-tree layouts differ
# per machine and per user, so they do not belong in the repository.
# If the manifest is missing or empty this recipe item is skipped (items 1-3
# already cover ordinary CJK documents). A listed directory that does not
# exist on this machine only warns, never aborts.
DIRS_FILE = HERE / 'content-dirs.local.txt'
CONTENT_DIRS = []
if DIRS_FILE.exists():
    for line in DIRS_FILE.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            CONTENT_DIRS.append(line)

# -- recipe item 2: symbol whitelist -----------------------------------------
# Light box drawing plus: heavy box drawing (┏┓┗┛┃━ family), diagonals ╱╲╳,
# shade/half blocks ░▒▓█▀▄▌▐, double arrows ⇐⇒⇑⇓⇔, filled/hollow triangles
# ▶◀▷◁△▽, stars ★☆, common typographic symbols •‣◦№§†‡‰¶©®™°±µ÷≈≠≤≥∞ and
# fullwidth bracket extras 〔〕〖〗.
SYMBOL_WHITELIST = (
    # -- light box drawing, geometry, CJK punctuation --
    '─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬╭╮╯╰'
    '▼▲►◄→←↑↓↕↔■□●○◆◇×✓✗'
    '…—–·、。,;:?!「」『』()【】《》〈〉""' "''" '　'
    # -- heavy box drawing and diagonals --
    '┏┓┗┛┃━┣┫┳┻╋╱╲╳'
    # -- shade and half blocks (terminal captures / progress bars) --
    '░▒▓█▀▄▌▐'
    # -- arrows and triangles --
    '⇐⇒⇑⇓⇔↖↗↘↙▶◀▷◁△▽'
    # -- common symbols --
    '•‣◦№§†‡‰¶©®™°±µ÷≈≠≤≥∞★☆〔〕〖〗'
)


def collect_chars() -> set[str]:
    # 1. printable ASCII
    chars = set(chr(i) for i in range(0x20, 0x7F))
    # 2. symbol whitelist
    chars.update(SYMBOL_WHITELIST)
    # 3. the level-1 3500 common Hanzi (checked-in file; `#` starts a comment)
    if not HANZI_FILE.is_file():
        sys.exit(f'missing {HANZI_FILE} — it ships with the repository; if it '
                 'is really gone, re-download level-1.txt from the source '
                 'repo named in its header comment.')
    for line in HANZI_FILE.read_text(encoding='utf-8').splitlines():
        if not line.startswith('#'):
            chars.update(line.strip())
    # 4. scan of existing content
    n_files = n_skipped = 0
    for d in CONTENT_DIRS:
        root = pathlib.Path(d)
        if not root.is_dir():
            print(f'warning: directory missing, skipped {d}', file=sys.stderr)
            continue
        for pattern in ('*.md', '*.mdx'):
            for f in root.rglob(pattern):
                if 'node_modules' in f.parts:
                    continue
                try:
                    chars.update(f.read_text(encoding='utf-8'))
                    n_files += 1
                except OSError as e:
                    n_skipped += 1
                    print(f'warning: unreadable, skipped {f} ({e})', file=sys.stderr)
                except UnicodeDecodeError:
                    n_skipped += 1
                    print(f'warning: not UTF-8, skipped {f}', file=sys.stderr)
    print(f'content scan: {n_files} files, {n_skipped} skipped')
    # control characters and whitespace stay out (except 0x20 space)
    return {c for c in chars if ord(c) >= 0x20 and c not in '\r\n\t'}


def find_source_ttf() -> str:
    src = os.environ.get('MAPLE_TTF') or next(iter(
        glob.glob(str(pathlib.Path.home()
                      / '.local/share/fonts/**/MapleMono*CN-Regular.ttf'),
                  recursive=True)
        + glob.glob('/usr/share/fonts/**/MapleMono*CN-Regular.ttf',
                    recursive=True)), None)
    if not src:
        sys.exit('no Maple Mono CN Regular ttf found — set '
                 'MAPLE_TTF=/path/to/MapleMono...CN-Regular.ttf')
    return src


def main() -> None:
    src = find_source_ttf()
    chars = collect_chars()

    font = TTFont(src)
    cmap = font.getBestCmap()
    have = [ord(c) for c in chars if ord(c) in cmap]
    missing = sorted(c for c in chars if ord(c) not in cmap)
    if missing:
        print(f'characters absent from the source font ({len(missing)}, '
              f'left out): {"".join(missing[:50])}', file=sys.stderr)

    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=have)
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(OUT)
    print(f'{OUT}: {len(have)} characters, {OUT.stat().st_size // 1024} KB (source {src})')


if __name__ == '__main__':
    main()
