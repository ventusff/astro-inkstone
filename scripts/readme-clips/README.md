# README clips

The GIFs and screenshots in `.github/assets/` are recorded, not hand-made:
each script here drives the demo in editing mode (`WIKI=1 astro dev`) with
a headless Chrome at 2× and a drawn cursor, captures every painted frame
with its real timestamp, and assembles the clip with ffmpeg at the speed
the session actually ran (sped up where a script says so).

| Script | Output | What it shows |
| --- | --- | --- |
| `hero.mjs` | `hero-edit.gif` | hover → ✎ → an inline formula typed into a paragraph, rendered in the live preview → save → the page re-rendered → dark theme |
| `tour-ai.mjs` | `tour-ai.gif` | ✦ → *Condense* → Claude's tool lines stream in → the block comes back shorter (needs the `claude` CLI) |
| `tour-wikilink.mjs` | `tour-wikilink.gif` | `[[` completion → the link in the preview → save → the target note's linked mentions |
| `tour-frontmatter.mjs` | `tour-frontmatter.gif` | the taxonomy strip's ✎ → the frontmatter as YAML → a status change re-renders the strip |
| `tour-table.mjs`, `tour-heading.mjs` | (not in the README) | a table cell edited live; a heading renamed with its number and ToC following |
| `shot-guard.mjs` | `guard.png` | the content guard refusing a save (an unpaired `**`) |
| `shot-history.mjs` | `history.png` | the ⟲ block-history popover |

`record-all.sh` runs the set and copies the results into `.github/assets/`;
every clip writes to the demo's content files and is reverted with git
afterwards. `lib.mjs` is the harness: login, cursor, editor helpers, the
frame-accurate recorder and the GIF encoder. `BASE` points the scripts at
another dev server; `REC_USER` names the signed-in user; `SPEED` overrides
a clip's playback factor.

The AI clip's commentary follows the machine's `claude` settings; a local
`demo/inkbrush.config.ts` (gitignored) with `claude.rules:
['Write your brief working commentary in English.']` keeps it in English.
