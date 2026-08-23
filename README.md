<h1 align="center">astro-inkstone</h1>

<p align="center"><b>A paper-and-ink design layer for Astro docs, wikis and digital gardens.</b></p>

<p align="center">
  <a href="https://github.com/ventusff/astro-inkstone/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/ventusff/astro-inkstone/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-2b2622"></a>
  <img alt="Astro 7" src="https://img.shields.io/badge/Astro-7-b6552e?logo=astro&logoColor=white">
</p>

<p align="center">
  <a href="https://ventusff.github.io/astro-inkstone/"><b>Live demo & manual&nbsp;→</b></a>
  &nbsp;·&nbsp;
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img alt="astro-inkstone demo, light and dark" src=".github/assets/demo-preview.png" width="920">
</p>

**Inkstone** (砚 — the stone an ink brush draws from) is the *look* of a documentation
or wiki site, packaged: design tokens, the content stylesheets, a component set,
and a one-line Markdown pipeline. You keep what makes a site *yours* — brand
color, layout chrome, routing — and inherit everything else.

It pairs with [**astro-inkbrush**](https://github.com/ventusff/astro-inkbrush)
(笔 — the brush), a tiny git-backed CMS that lets you edit the very same pages
in place. Use them together for a wiki you can write *in*, or use Inkstone
alone for a static site that simply looks and reads beautifully.

## Features

- 🎨 **Two-tier design tokens, two contexts** — a raw palette of papers and
  painter's pigments (`--p-*`: 朱 wine, 石 burnt orange, 赭 ochre, 黛 teal,
  紫 violet) feeding two semantic contexts: the *reading column*
  (`--color-*`, a cool paper and one accent for an hour of reading) and the
  *browse shelf* (`--wb-*`, warm paper, a display serif, a wine-red mark for
  landing and facet pages). Re-skin the whole site by overriding either
  tier; every text run rendered in the default state is **measured** for
  WCAG AA against the pixels it actually sits on, at its rendered opacity
  (`scripts/contrast_probe.mjs`, both themes, dialogs probed open).
- 🌗 **Deliberate theming** — light is the identity; dark ships complete and
  activates only via `[data-theme='dark']`, so your toggle owns the decision
  (no `prefers-color-scheme` surprises).
- 📖 **Two stylesheets, one look** — `base.css` is the reading column of a
  long-form wiki: serif body, chapter rules, code frames (title bar, copy
  button, collapse, line annotations, diff/focus/word highlight), tables that
  reflow into cards on narrow containers with pure CSS container queries,
  callouts (folding included), figure groups, academic paper cards, hub cards
  and reading paths, reference lists, reduced-motion handling, and a print
  stylesheet that turns any page into a clean PDF. `browse.css` is the
  shelf — masthead, ruled shelves, card grid, status legend, instant
  filters, tag cloud.
- 🧩 **25 Astro components** — `Hero`, `Part`, `PartHero`, `Callout`,
  `Steps`, `Grid`, `PaperCard`, `HubCard`, `Stats`, `LocalToc`, `Backlinks`,
  `SearchPalette` (the ⌘K overlay over the search factory + client, with
  optional crumb-scoped filter chips; any `[data-search-open]` element opens it),
  `LocalGraph` (a note's one-hop link neighbourhood in the sidebar), a faceted
  wiki-browsing set (`NoteCard`, `FacetNav`, `TaxonomyLine`, …), and more.
  Presentational and token-driven: they follow your palette automatically.
- 🌱 **Digital-garden machinery** — a taxonomy factory (kinds / domains /
  tags / status, hub notes with numbered chapters, locale mirrors) and a
  backlink-index builder with context snippets, both bound to your own
  vocabulary in a three-line site module. The demo garden runs on them.
- ⚙️ **One-line Markdown pipeline** — `siteMarkdown()` assembles GFM,
  CJK-friendly emphasis, KaTeX (dual-theme), Mermaid, Obsidian-style
  callouts, `[[wikilinks]]`, reading time, auto-numbered headings with ToC
  extraction, base-prefix link rewriting, and a build-time **content guard**
  that fails the build on silent Markdown deformations instead of shipping
  them.
- 🀄 **CJK-first typography** — emphasis that survives Chinese punctuation
  (`**报文。**同时` bolds correctly), CJK-aware reading time, and a tuned
  code-font subset (Maple Mono CN) where Hanzi sit exactly two cells wide.
- 🔍 **Search included** — a build-time index endpoint factory plus a tiny
  dependency-free client.
- 🩺 **Render-layer probes** — two headless-Chrome checkers: `ui_probe`
  loads every built page at four viewport widths and fails CI on horizontal
  overflow, unstyled classes, dead anchors, missing alt text and skipped
  headings, duplicate ids and dangling `aria-controls`; `contrast_probe`
  samples from pixels the ground every rendered text run sits on — HTML,
  SVG and generated text, both themes, two widths — and fails on anything
  under WCAG AA. Unit tests cover the library (`npm test`).
- 🪶 **Zero build step** — plain TypeScript and CSS, consumed as source by
  your site's own Vite. Pin it by commit like any other part of your site.

## Quick start

Try the demo (it is also the manual — written with the package itself):

```bash
git clone --recurse-submodules https://github.com/ventusff/astro-inkstone
cd astro-inkstone && npm install
cd demo && npm install && npm run dev
```

## Using it in your site

Inkstone isn't published to npm — it is designed to be **vendored as a git
submodule** and imported as source. You get exact commit pinning, readable
code in your editor instead of a dist blob, and zero publish lag:

```bash
git submodule add https://github.com/ventusff/astro-inkstone.git packages/astro-inkstone
git submodule add https://github.com/ventusff/astro-inkbrush.git packages/astro-inkbrush
```

Declare them in your site's `package.json` — pnpm workspaces
(`"astro-inkstone": "workspace:*"` with `packages/*` in
`pnpm-workspace.yaml`) or npm `file:` links both work.

```ts
// astro.config.ts — the whole Markdown pipeline in one line
import { defineConfig } from 'astro/config';
import { siteMarkdown } from 'astro-inkstone/markdown-preset';

export default defineConfig({
  markdown: siteMarkdown({ math: true, callouts: true, mermaid: true, codeFrame: true }),
});
```

```css
/* your global stylesheet: tokens, the reading column, then (for a wiki) the shelf */
@import 'astro-inkstone/styles/tokens.css';
@import 'astro-inkstone/styles/base.css';
@import 'astro-inkstone/styles/browse.css'; /* landing / facet pages, on body.wb-root */

/* identity: override the raw pigments — the day pigment and its night twin… */
:root { --p-shi: #8a4baf; --p-shi-n: #b98fd6; --p-zhu: #3b4a7a; --p-zhu-n: #93a3cf; }
/* …or re-map the semantic tokens (--color-* / --wb-*) onto your own palette — both paths are supported */
```

```html
<!-- the reading column: base.css styles prose inside a .col column -->
<main class="note-main"><div class="col">
  <!-- your rendered Markdown -->
</div></main>
```

The shelf's display serif (`--font-display`: Source Serif 4 + Noto Serif SC)
and the UI sans (Inter) are self-hosted by the demo through `@fontsource`;
install the same packages and import their CSS to see exactly what the demo
shows — without them the stacks fall back to system faces.

Layout, navigation, routing and deployment stay yours — the demo ships a
complete reference implementation (a warm-paper landing shelf with facet
pages, hub notes with chapter rails, a sidebar table of contents that follows
your reading position with a local link graph beneath it, ⌘K search and zh
mirror routing). The editing-machine deployment shape is documented with the
engine, in [astro-inkbrush's manual](https://github.com/ventusff/astro-inkbrush/blob/main/docs/manual.md).

## Who does what

```
astro-inkbrush   the brush — editing: in-place block CMS, revision history,
                 comments, AI assist, Obsidian inbox, Markdown dialect + guard
astro-inkstone   the stone — appearance: tokens, content styles, components,
                 pipeline preset, fonts, render checks
your site        the hand — identity: brand palette, layout chrome, routing,
                 content, deployment
```

The Markdown preset builds on inkbrush's dialect (so what the editor accepts
and what the page renders are one grammar) — add both submodules, as the demo
does. The token/style/component layer has no engine dependency.

## Documentation

The [demo site](https://ventusff.github.io/astro-inkstone/) is a multi-note
taxonomy garden whose notes are the manual: browse by kind, domain and tag;
a hub note with numbered chapters; wikilinked notes with linked-mentions
panels; and pages covering installation, the token architecture, a
kitchen-sink of every pipeline feature and the check tooling. Everything on
it is built with the package, so every page is also a living test.

## FAQ

**Why no npm package?** — A design layer changes in lockstep with the sites
that use it. Submodules give you exact commit pinning, transparent source in
`node_modules`-free form, and instant local patching. If you prefer a
registry workflow, vendoring a tagged commit works just as well.

**Can I use it without the CMS engine?** — Yes for tokens, styles and
components. `siteMarkdown()` imports the engine's dialect, so keep the
engine submodule if you want the pipeline preset (your build never ships any
of its editing code — the CMS activates only in dev mode).

**How do I update?** — `git submodule update --remote packages/astro-inkstone`,
review the diff, commit the pointer. Your site pins exactly what it tested.

## License

[MIT](LICENSE) © Jianfei Guo. Code font: a subset of
[Maple Mono](https://github.com/subframe7536/maple-font), released under the
[SIL OFL 1.1](fonts/OFL.txt) — see [`fonts/README.md`](fonts/README.md).
