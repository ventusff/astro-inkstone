#!/usr/bin/env python3
"""Build the CJK monospace font subset used for code blocks.

Box diagrams inside code blocks align only when a Hanzi is exactly two
character cells wide and Latin and Hanzi come from one font. Maple Mono CN
satisfies both (Latin 600, Hanzi 1200, box drawing 600, in 1/1000 em units);
the full font is tens of MB, this script cuts the self-hosted subset.

The recipe is fixed and lives entirely in the repository, so the artifact is
reproducible from a checkout plus the pinned source font:
  1. the printable ASCII range 0x20-0x7e;
  2. SYMBOL_WHITELIST — box drawing, arrows, geometry, common symbols, CJK
     punctuation;
  3. the 3500 level-1 characters of the Table of General Standard Chinese
     Characters (hanzi-3500.txt);
  4. extra-chars.txt — every further character the subset carries, one
     `U+XXXX` per line. `--scan <dir>…` extends it with the characters found
     in *.md / *.mdx content (those the source font has; the rest are
     reported), and that change is committed like any other.

The source is pinned by SHA-256 (SOURCE below). A different file is refused
unless `--any-source` is given, which prints the file's hash for re-pinning.
A recipe character the source lacks is an error, not a warning.

Usage:
  <venv>/bin/python fonts/build_font_subset.py [--scan DIR ...] [--any-source]
  MAPLE_TTF=/path/to/MapleMono...CN-Regular.ttf  overrides source discovery
Needs: fonttools, brotli.   Output: fonts/MapleMonoCN-subset.woff2 plus
fonts/coverage.txt, the subset's actual code points — the sidecar that lets
`test/font-coverage.test.ts` hold the committed artifact against the recipe
and the demo content without a font stack. Commit the three files together.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import os
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'MapleMonoCN-subset.woff2'
HANZI_FILE = HERE / 'hanzi-3500.txt'
EXTRA_FILE = HERE / 'extra-chars.txt'

# the pinned source: Maple Mono "Normal NL NF CN" Regular, upstream release 7.9
SOURCE = {
    'name': 'MapleMonoNormalNL-NF-CN-Regular.ttf',
    'version': '7.900',
    'sha256': '446ba8586f8c99fc044da4b64b114028799c774cd07112b5cb7027bb551192f0',
}

# recipe item 2: light and heavy box drawing, diagonals, shade blocks, arrows
# and triangles, geometry, common typographic symbols, fullwidth punctuation
SYMBOL_WHITELIST = (
    '─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬╭╮╯╰'
    '▼▲►◄→←↑↓↕↔■□●○◆◇×✓✗'
    '…—–·、。,;:?!「」『』()【】《》〈〉""' "''" '　'
    '┏┓┗┛┃━┣┫┳┻╋╱╲╳'
    '░▒▓█▀▄▌▐'
    '⇐⇒⇑⇓⇔↖↗↘↙▶◀▷◁△▽'
    '•‣◦№§†‡‰¶©®™°±µ÷≈≠≤≥∞〔〕〖〗'
)


def base_chars() -> set[str]:
    """recipe items 1-3"""
    chars = {chr(i) for i in range(0x20, 0x7F)}
    chars.update(SYMBOL_WHITELIST)
    if not HANZI_FILE.is_file():
        sys.exit(f'missing {HANZI_FILE} (it ships with the repository)')
    for line in HANZI_FILE.read_text(encoding='utf-8').splitlines():
        if not line.startswith('#'):
            chars.update(line.strip())
    return chars


def read_extra() -> set[str]:
    """recipe item 4"""
    chars: set[str] = set()
    if not EXTRA_FILE.is_file():
        return chars
    for n, line in enumerate(EXTRA_FILE.read_text(encoding='utf-8').splitlines(), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        token = line.split()[0]
        if not token.startswith('U+'):
            sys.exit(f'{EXTRA_FILE}:{n}: expected "U+XXXX", got {line!r}')
        chars.add(chr(int(token[2:], 16)))
    return chars


def write_extra(chars: set[str]) -> None:
    head = [
        '# Recipe item 4 of fonts/build_font_subset.py: characters beyond ASCII, the',
        '# symbol whitelist and the 3500 common Hanzi that the subset also carries.',
        '# One character per line as U+XXXX plus the glyph; `#` starts a comment.',
        '# Maintained by `build_font_subset.py --scan <dir>…`, which appends every',
        '# character found in *.md / *.mdx content that the source font has.',
    ]
    lines = []
    for c in sorted(chars):
        cp = ord(c)
        printable = not (0x300 <= cp <= 0x36F or cp in (0x200B, 0xFFFD))
        lines.append(f'U+{cp:04X} {c}' if printable else f'U+{cp:04X}')
    EXTRA_FILE.write_text('\n'.join(head + lines) + '\n', encoding='utf-8')


def scan_content(dirs: list[str]) -> set[str]:
    chars: set[str] = set()
    for d in dirs:
        root = pathlib.Path(d)
        if not root.is_dir():
            sys.exit(f'--scan: not a directory: {d}')
        for pattern in ('*.md', '*.mdx'):
            for f in root.rglob(pattern):
                if 'node_modules' in f.parts:
                    continue
                chars.update(f.read_text(encoding='utf-8'))
    return {c for c in chars if ord(c) >= 0x20 and c not in '\r\n\t'}


def find_source_ttf() -> str:
    src = os.environ.get('MAPLE_TTF') or next(iter(
        glob.glob(str(pathlib.Path.home() / '.local/share/fonts/**' / SOURCE['name']), recursive=True)
        + glob.glob(f"/usr/share/fonts/**/{SOURCE['name']}", recursive=True)), None)
    if not src:
        sys.exit(f"source font not found — install {SOURCE['name']} (Maple Mono {SOURCE['version']}) "
                 'or set MAPLE_TTF=/path/to/it')
    return src


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--scan', nargs='+', metavar='DIR', help='extend extra-chars.txt with content characters')
    ap.add_argument('--any-source', action='store_true', help='accept a source font other than the pinned one')
    args = ap.parse_args()

    src = find_source_ttf()
    digest = hashlib.sha256(pathlib.Path(src).read_bytes()).hexdigest()
    if digest != SOURCE['sha256']:
        if not args.any_source:
            sys.exit(f'{src}: sha256 {digest} is not the pinned source ({SOURCE["sha256"]}); '
                     'pass --any-source to build from it anyway')
        print(f'warning: building from an unpinned source (sha256 {digest})', file=sys.stderr)
    font = TTFont(src)
    cmap = font.getBestCmap()

    base = base_chars()
    extra = read_extra()
    if args.scan:
        found = scan_content(args.scan) - base - extra
        absent = sorted(c for c in found if ord(c) not in cmap)
        added = {c for c in found if ord(c) in cmap}
        extra |= added
        write_extra(extra)
        print(f'--scan: {len(added)} characters added to {EXTRA_FILE.name}'
              + (f'; {len(absent)} not in the source font, left out: {"".join(absent)}' if absent else ''))

    chars = base | extra
    scan_absent = absent if args.scan else []
    missing = sorted(c for c in chars if ord(c) not in cmap)
    if missing:
        sys.exit(f'{len(missing)} recipe characters are absent from the source font: '
                 f'{"".join(missing)}\nremove them from the recipe or pin a source that has them')

    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=[ord(c) for c in chars])
    sub.subset(font)
    font.flavor = 'woff2'
    font.save(OUT)

    subset_cmap = sorted(TTFont(OUT).getBestCmap())
    coverage = OUT.parent / 'coverage.txt'
    lines = [
        '# Code points present in MapleMonoCN-subset.woff2, one U+XXXX per line.',
        '# Generated by build_font_subset.py alongside the woff2; commit together.',
        '# `absent NNNN` lines list scanned content characters the source font lacks.',
    ]
    lines += [f'absent {ord(c):04X}' for c in scan_absent]
    lines += [f'U+{cp:04X}' for cp in subset_cmap]
    coverage.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{OUT.name}: {len(chars)} characters, {OUT.stat().st_size // 1024} KB (source {src})')
    print(f'{coverage.name}: {len(subset_cmap)} code points in the subset cmap')


if __name__ == '__main__':
    main()
