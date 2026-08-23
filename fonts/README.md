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
| `coverage.txt` | the subset's actual cmap, written by the generator; `test/font-coverage.test.ts` holds it against the recipe and the demo content |
| `build_font_subset.py` | the generator (fixed recipe, below; the source font pinned by SHA-256) |
| `hanzi-3500.txt` | the 3500 level-1 characters of the Table of General Standard Chinese Characters |
| `extra-chars.txt` | recipe item 4: every further character the subset carries, one `U+XXXX` per line |
| `OFL.txt` | the SIL Open Font License 1.1 for the Maple Mono upstream |

## The recipe (union of four parts)

1. the full printable ASCII range 0x20–0x7e;
2. a symbol whitelist: box drawing (light/heavy/double/rounded), arrows,
   geometry, shade blocks, common typographic symbols, fullwidth CJK
   punctuation (`SYMBOL_WHITELIST` in the script);
3. the 3500 level-1 characters of the Table of General Standard Chinese
   Characters (2013) — `hanzi-3500.txt`, source in that file's header;
4. `extra-chars.txt` — characters gathered from content (accents, Greek,
   math operators, fullwidth forms, …), tracked so the recipe is complete in
   the repository.

Source font: Maple Mono 7.9, the "Normal NL NF CN" Regular build (no
ligatures, with CJK), pinned by SHA-256 in the script. A character in the
recipe that the source lacks fails the build.

When content uses a character outside the subset, the browser falls back to
a system font for that glyph (alignment may be loose there). To fold it in:

```bash
python3 -m venv /tmp/fontenv && /tmp/fontenv/bin/pip install 'fonttools==4.63.0' 'brotli==1.1.0'
/tmp/fontenv/bin/python fonts/build_font_subset.py --scan path/to/content   # extends extra-chars.txt
```

then commit `extra-chars.txt`, the regenerated `MapleMonoCN-subset.woff2`
and `coverage.txt` together. The build is deterministic (a fixed
`SOURCE_DATE_EPOCH`): the same source, recipe and pinned toolchain
reproduce the artifact byte for byte. The source ttf is auto-discovered under `~/.local/share/fonts/**/`
and `/usr/share/fonts/**/`, or pointed at with `MAPLE_TTF=/path/to/it`.

## License

Maple Mono is released under the
[SIL Open Font License 1.1](https://openfontlicense.org) (full text in
`OFL.txt`), which permits subsetting and self-hosted redistribution.
Upstream: <https://github.com/subframe7536/maple-font> (its CN glyphs come
from a merged Chinese font, also OFL). Keep this notice and `OFL.txt`
alongside the subset when redistributing.
