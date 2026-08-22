# Maple Mono CN subset (fixed charset, shared by every site)

The monospace font used for code blocks and box diagrams, as a CJK-capable
subset. Latin glyphs are exactly 600, Hanzi exactly 1200, box drawing and
arrows 600 (units of 1/1000 em) — a strict 1:2 Latin/Hanzi ratio, so mixed
Chinese/English box diagrams never skew. The full font weighs tens of MB;
this subset (~4000 characters, ~900 KB woff2) is cut once from a fixed
recipe and self-hosted — every consuming site ships the same file instead of
scanning its own content.

## Files

| File | What it is |
| --- | --- |
| `MapleMonoCN-subset.woff2` | the subset artifact, committed; sites reference it directly |
| `build_font_subset.py` | the generator (fixed recipe, below) |
| `hanzi-3500.txt` | the 3500 level-1 characters of the Table of General Standard Chinese Characters, kept in-repo so generation works offline |
| `OFL.txt` | the SIL Open Font License 1.1 for the Maple Mono upstream |

## The recipe (union of four parts)

1. the full printable ASCII range 0x20–0x7e;
2. a symbol whitelist: box drawing (light/heavy/double/rounded), arrows,
   geometry, shade blocks, common typographic symbols, fullwidth CJK
   punctuation (see `SYMBOL_WHITELIST` in the script);
3. the 3500 level-1 characters of the Table of General Standard Chinese
   Characters (2013) — `hanzi-3500.txt`, source in that file's header;
4. the union of every character used in `*.md` / `*.mdx` content under the
   directories listed in an optional, untracked local manifest
   (`content-dirs.local.txt` — one absolute path per line) — so existing
   content has zero missing glyphs at generation time.

When new content uses a rare character outside the subset, the browser falls
back to a system font for that glyph (alignment may be loose there); re-run
the script to fold it in.

## Regenerating

System `python3` usually lacks fontTools; use a venv:

```bash
python3 -m venv /tmp/fontenv          # or: uv venv /tmp/fontenv
/tmp/fontenv/bin/pip install fonttools brotli
/tmp/fontenv/bin/python fonts/build_font_subset.py
```

- The source ttf is auto-discovered under `~/.local/share/fonts/**/` and
  `/usr/share/fonts/**/` (`MapleMono*CN-Regular.ttf`); or point at one with
  `MAPLE_TTF=/path/to/xxx.ttf`. The "Normal NL NF CN" build (no ligatures,
  with CJK) is a good source.
- To widen the content union, list content directories in
  `fonts/content-dirs.local.txt` (gitignored, machine-local) and re-run.
- The output overwrites `fonts/MapleMonoCN-subset.woff2`; commit it.

## License

Maple Mono is released under the
[SIL Open Font License 1.1](https://openfontlicense.org) (full text in
`OFL.txt`), which permits subsetting and self-hosted redistribution.
Upstream: <https://github.com/subframe7536/maple-font> (its CN glyphs come
from a merged Chinese font, also OFL). Keep this notice and `OFL.txt`
alongside the subset when redistributing.
